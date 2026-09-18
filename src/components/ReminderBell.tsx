"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "./I18nProvider";

type Reminder = {
  code: string;
  court: string;
  date: string;
  start: number;
  end: number;
  startsAt: number;
  endsAt: number;
};

const notifiedKey = (r: Reminder) => `snp-notified:${r.code}:${r.startsAt}`;

function wasNotified(r: Reminder): boolean {
  try {
    return localStorage.getItem(notifiedKey(r)) === "1";
  } catch {
    return false;
  }
}
function markNotified(r: Reminder) {
  try {
    localStorage.setItem(notifiedKey(r), "1");
  } catch {
    /* storage diblokir: pengingat tetap tampil di lonceng */
  }
}

export function ReminderBell() {
  const { t, f } = useI18n();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [leadMinutes, setLeadMinutes] = useState(60);
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [toast, setToast] = useState<Reminder | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/reminders", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setReminders(data.reminders);
      setLeadMinutes(data.reminderMinutes);
    } catch {
      /* offline: coba lagi di interval berikutnya */
    }
    setNow(Date.now());
  }, []);

  useEffect(() => {
    setPermission("Notification" in window ? Notification.permission : "unsupported");
    const poll = setInterval(load, 60_000);
    const tick = setInterval(() => setNow(Date.now()), 20_000);
    window.addEventListener("focus", load);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
      window.removeEventListener("focus", load);
    };
  }, [load]);

  // Booking baru/batal selalu diikuti pindah halaman — muat ulang supaya lonceng tidak menunggu interval.
  useEffect(() => {
    load();
  }, [pathname, load]);

  // Kirim pengingat sekali per booking begitu masuk jendela waktu yang dipilih user.
  useEffect(() => {
    for (const r of reminders) {
      const untilStart = r.startsAt - now;
      if (untilStart <= 0 || untilStart > leadMinutes * 60_000 || wasNotified(r)) continue;
      markNotified(r);
      setToast(r);
      if (permission === "granted") {
        new Notification(t.reminder.notifTitle, {
          body: `${r.court} · ${f.range(r.start, r.end)} · ${f.countdown(untilStart)}`,
          tag: r.code,
        });
      }
    }
  }, [reminders, now, leadMinutes, permission, t, f]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const active = reminders.filter((r) => r.endsAt > now);
  const soon = active.filter((r) => r.startsAt - now <= 24 * 3600_000);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={t.reminder.aria(soon.length)}
        className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-line bg-white hover:border-court-700"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0" />
        </svg>
        {soon.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-clay-600 px-1 text-[10px] font-bold text-white">
            {soon.length}
          </span>
        )}
      </button>

      {open && (
        <div className="card absolute right-0 mt-2 w-[min(20rem,calc(100vw-2rem))] p-4 shadow-xl shadow-court-950/10">
          <p className="font-display text-base font-semibold">{t.reminder.title}</p>
          {active.length === 0 ? (
            <p className="mt-2 text-sm text-muted">{t.reminder.none}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {active.map((r) => {
                const due = r.startsAt - now <= leadMinutes * 60_000;
                return (
                  <li key={r.code} className={`rounded-xl border p-3 ${due ? "border-clay-500/40 bg-clay-50" : "border-line bg-cream"}`}>
                    <p className="text-sm font-semibold">{r.court}</p>
                    <p className="text-xs text-muted">
                      {f.dateShort(r.date)} · {f.range(r.start, r.end)}
                    </p>
                    <p className={`mt-1 text-xs font-semibold ${due ? "text-clay-700" : "text-court-700"}`}>{f.countdown(r.startsAt - now)}</p>
                  </li>
                );
              })}
            </ul>
          )}

          {permission === "default" && (
            <button className="btn btn-primary btn-sm mt-3 w-full" onClick={async () => setPermission(await Notification.requestPermission())}>
              {t.reminder.enable}
            </button>
          )}
          {permission === "denied" && <p className="mt-3 text-xs text-muted">{t.reminder.blocked}</p>}
          <div className="mt-3 flex justify-between gap-3 text-xs font-medium text-court-700">
            <Link href="/booking-saya" className="hover:underline" onClick={() => setOpen(false)}>
              {t.reminder.seeAll}
            </Link>
            <Link href="/akun" className="hover:underline" onClick={() => setOpen(false)}>
              {t.reminder.setTime}
            </Link>
          </div>
        </div>
      )}

      {/* Portal ke body: header memakai backdrop-filter, yang menjadikannya containing block untuk elemen fixed. */}
      {toast &&
        createPortal(
          <div role="status" className="fixed bottom-4 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl bg-court-900 p-4 text-cream shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-ball">{t.reminder.toastEyebrow}</p>
            <p className="mt-1 font-display text-lg font-semibold">{t.reminder.toastTitle}</p>
            <p className="mt-0.5 text-sm text-cream/80">
              {toast.court} · {f.dateShort(toast.date)} · {f.range(toast.start, toast.end)}
            </p>
            <div className="mt-3 flex gap-2">
              <Link href="/booking-saya" className="btn btn-ball btn-sm" onClick={() => setToast(null)}>
                {t.reminder.view}
              </Link>
              <button className="btn btn-sm text-cream/80 hover:text-cream" onClick={() => setToast(null)}>
                {t.common.close}
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
