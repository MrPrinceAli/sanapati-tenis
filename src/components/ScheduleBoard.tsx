"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { bookSlot } from "@/app/actions/booking";
import { opt } from "@/lib/i18n";
import { hourRange, slotMs } from "@/lib/time";
import { useI18n } from "./I18nProvider";
import { FormMessage, SubmitButton } from "./ui";

export type SlotState = "booked" | "mine" | "block" | "club";
type CourtLite = { id: number; name: string; surface: string; indoor: number; open_hour: number; close_hour: number };
type Selection = { courtId: number; start: number; end: number } | null;

type Props = {
  date: string;
  /** Keterangan jadwal rutin per lapangan, mis. "Jadwal Rutin Sanapati Tenis Club". */
  clubNote: Record<number, string>;
  courts: CourtLite[];
  busy: Record<number, Record<number, SlotState>>;
  nowMs: number;
  loggedIn: boolean;
};

export function ScheduleBoard({ date, courts, busy, clubNote, nowMs, loggedIn }: Props) {
  const { t, f, rules } = useI18n();
  const [sel, setSel] = useState<Selection>(null);
  const [hint, setHint] = useState(false);
  const [state, action] = useActionState(bookSlot, null);
  const dateLabel = f.dateLong(date);
  // Rentang baris mengikuti lapangan yang buka paling pagi dan tutup paling malam.
  const HOURS = hourRange(Math.min(...courts.map((c) => c.open_hour)), Math.max(...courts.map((c) => c.close_hour)));

  function toggle(courtId: number, h: number) {
    setHint(false);
    if (!sel || sel.courtId !== courtId) return setSel({ courtId, start: h, end: h + 1 });
    const { start, end } = sel;
    const length = end - start;
    if (h === end || h === start - 1) {
      if (length >= rules.maxDuration) return setHint(true);
      return setSel(h === end ? { courtId, start, end: end + 1 } : { courtId, start: h, end });
    }
    if (h === start) return setSel(length === 1 ? null : { courtId, start: start + 1, end });
    if (h === end - 1) return setSel({ courtId, start, end: end - 1 });
    setSel({ courtId, start: h, end: h + 1 });
  }

  const court = sel ? courts.find((c) => c.id === sel.courtId) : undefined;
  const allPast = HOURS.every((h) => slotMs(date, h) <= nowMs);

  return (
    <div className="mt-4 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="card overflow-hidden">
        <div className="flex flex-wrap gap-x-5 gap-y-2 border-b border-line px-4 py-3 text-xs text-muted">
          {[
            ["border border-court-200 bg-court-50", t.schedule.legendFree],
            ["bg-court-900", t.schedule.legendSelected],
            ["bg-ball", t.schedule.legendMine],
            ["bg-sand", t.schedule.legendTaken],
            ["bg-court-200", t.schedule.club],
          ].map(([cls, label]) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className={`h-3 w-3 rounded ${cls}`} />
              {label}
            </span>
          ))}
        </div>

        <div className="overflow-x-auto">
          <div
            className="grid gap-1 p-2.5 sm:gap-1.5 sm:p-4"
            style={{ gridTemplateColumns: `2.6rem repeat(${courts.length}, minmax(3.5rem, 1fr))` }}
            role="grid"
            aria-label={t.schedule.gridLabel(dateLabel)}
          >
            <div />
            {courts.map((c) => (
              <div key={c.id} className="px-1 pb-2 text-center" role="columnheader">
                <p className="text-sm font-semibold leading-tight sm:text-base">{c.name}</p>
                <p className="mt-0.5 text-[11px] text-muted">
                  {opt(t, c.surface)} · {c.indoor ? t.common.indoor : t.common.outdoor}
                </p>
              </div>
            ))}

            {HOURS.map((h) => (
              <div key={h} className="contents" role="row">
                <div className="flex items-center justify-end pr-1 text-xs tabular-nums text-muted" role="rowheader">
                  {f.hour(h)}
                </div>
                {courts.map((c) => {
                  const outside = h < c.open_hour || h >= c.close_hour;
                  const taken = outside ? "block" : busy[c.id]?.[h];
                  const past = slotMs(date, h) <= nowMs;
                  const selected = sel?.courtId === c.id && h >= sel.start && h < sel.end;

                  if (taken || past) {
                    const label =
                      taken === "mine"
                        ? t.schedule.legendMine
                        : taken === "club"
                          ? clubNote[c.id] || t.schedule.club
                          : taken === "block"
                            ? t.schedule.closed
                            : taken
                              ? t.schedule.taken
                              : t.schedule.past;
                    return (
                      <div
                        key={c.id}
                        role="gridcell"
                        aria-label={`${c.name} ${f.hour(h)}: ${label}`}
                        title={taken === "club" ? clubNote[c.id] || undefined : undefined}
                        className={`flex h-11 items-center justify-center rounded-lg text-xs font-medium ${
                          taken === "mine" ? "bg-ball text-court-950" : taken === "club" ? "bg-court-200 text-court-800" : taken ? "bg-sand text-muted" : "bg-cream text-muted/50"
                        }`}
                      >
                        {taken === "club" ? (
                          // Tampilkan keterangan yang diatur admin. Di layar sempit dipotong rapi dengan elipsis,
                          // dan kalau kolomnya benar-benar sempit jatuh ke kata pendek supaya tetap terbaca.
                          <>
                            <span className="hidden w-full truncate px-1.5 text-center sm:inline-block">
                              {clubNote[c.id] || t.schedule.club}
                            </span>
                            <span className="sm:hidden">{t.schedule.club}</span>
                          </>
                        ) : taken === "block" ? (
                          <span className="flex h-full w-full items-center justify-center rounded-lg bg-[repeating-linear-gradient(135deg,transparent_0_4px,rgba(19,33,27,.12)_4px_6px)]">
                            {t.schedule.closed}
                          </span>
                        ) : taken === "mine" ? (
                          t.schedule.mine
                        ) : taken ? (
                          t.schedule.taken
                        ) : (
                          "—"
                        )}
                      </div>
                    );
                  }
                  return (
                    <button
                      key={c.id}
                      role="gridcell"
                      aria-selected={selected}
                      aria-label={`${c.name} ${f.range(h, h + 1)}: ${t.schedule.free}`}
                      onClick={() => toggle(c.id, h)}
                      className={`h-11 cursor-pointer rounded-lg border text-xs font-semibold transition ${
                        selected
                          ? "border-court-900 bg-court-900 text-cream"
                          : "border-court-200 bg-court-50 text-court-800 hover:border-court-700 hover:bg-court-100"
                      }`}
                    >
                      {selected ? "✓" : t.schedule.free}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <aside id="ringkasan" className="card scroll-mt-24 p-5 lg:sticky lg:top-24" aria-live="polite">
        <h2 className="text-lg font-semibold">{t.schedule.summary}</h2>
        {!sel || !court ? (
          <p className="mt-2 text-sm text-muted">{allPast ? t.schedule.allPast : t.schedule.hintEmpty}</p>
        ) : (
          <form action={action} className="mt-3 space-y-4">
            <input type="hidden" name="courtId" value={sel.courtId} />
            <input type="hidden" name="date" value={date} />
            <input type="hidden" name="start" value={sel.start} />
            <input type="hidden" name="end" value={sel.end} />
            <div className="border-b border-line pb-4">
              <p className="font-display text-xl font-bold">{court.name}</p>
              <p className="text-sm text-muted">{dateLabel}</p>
              <p className="mt-1 text-sm font-semibold text-court-700">
                {f.range(sel.start, sel.end)} WIB · {t.common.hours(sel.end - sel.start)}
              </p>
            </div>
            {loggedIn ? (
              <>
                <div>
                  <label htmlFor="note" className="label">
                    {t.schedule.note} <span className="font-normal text-muted">{t.common.optional}</span>
                  </label>
                  <input id="note" name="note" maxLength={300} className="input" placeholder={t.schedule.notePh} />
                </div>
                <FormMessage state={state} />
                <SubmitButton className="btn btn-primary w-full">{t.schedule.confirm}</SubmitButton>
                <p className="text-center text-xs text-muted">{t.schedule.freeNote}</p>
              </>
            ) : (
              <Link href={`/masuk?next=${encodeURIComponent(`/booking?tanggal=${date}`)}`} className="btn btn-primary w-full">
                {t.schedule.loginToBook}
              </Link>
            )}
            <button type="button" onClick={() => setSel(null)} className="w-full cursor-pointer text-center text-xs font-medium text-muted hover:text-ink">
              {t.schedule.clear}
            </button>
          </form>
        )}
        {hint && <p className="mt-3 rounded-xl bg-clay-50 px-3 py-2 text-xs text-clay-700">{t.schedule.maxHint}</p>}
      </aside>

      {sel && court && (
        <a
          href="#ringkasan"
          className="fixed inset-x-3 bottom-3 z-30 flex items-center justify-between rounded-2xl bg-court-900 px-4 py-3 text-cream shadow-2xl lg:hidden"
        >
          <span className="text-sm">
            <span className="block font-semibold">{court.name}</span>
            <span className="text-cream/70">
              {f.range(sel.start, sel.end)} · {t.common.hours(sel.end - sel.start)}
            </span>
          </span>
          <span className="rounded-full bg-ball px-4 py-2 text-sm font-semibold text-court-950">{t.schedule.next}</span>
        </a>
      )}
    </div>
  );
}
