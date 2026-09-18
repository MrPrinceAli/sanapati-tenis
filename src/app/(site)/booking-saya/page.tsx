import type { Metadata } from "next";
import Link from "next/link";
import { CancelDialog } from "@/components/CancelDialog";
import { requireUser } from "@/lib/auth";
import { canUserCancel, getUserBookings, isPast, type BookingRow } from "@/lib/bookings";
import { translateReason, type Dict, type Formatters } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n-server";
import { slotMs } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.my.metaTitle };
}

function StatusBadge({ b, t }: { b: BookingRow; t: Dict }) {
  if (b.status === "cancelled") return <span className="badge bg-clay-100 text-clay-700">{t.my.stCancelled}</span>;
  if (isPast(b)) return <span className="badge bg-sand text-muted">{t.my.stDone}</span>;
  if (slotMs(b.date, b.start_hour) <= Date.now()) return <span className="badge bg-ball text-court-950">{t.my.stOngoing}</span>;
  return <span className="badge bg-court-100 text-court-800">{t.my.stConfirmed}</span>;
}

function BookingCard({ b, upcoming, t, f }: { b: BookingRow; upcoming: boolean; t: Dict; f: Formatters }) {
  return (
    <li className={`card p-5 ${upcoming ? "" : "bg-white/60"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge b={b} t={t} />
        <span className="font-mono text-xs text-muted">{b.code}</span>
      </div>
      <h3 className="mt-2 text-xl font-semibold">{b.court_name}</h3>
      <p className="text-sm text-muted">
        {f.dateLong(b.date)} · {f.range(b.start_hour, b.end_hour)} WIB · {t.common.hours(b.end_hour - b.start_hour)}
      </p>
      {b.note && (
        <p className="mt-3 text-sm text-muted">
          {t.my.note}: {b.note}
        </p>
      )}
      {b.status === "cancelled" && (
        <p className="mt-3 rounded-xl bg-clay-50 px-3.5 py-2 text-xs text-clay-700">
          {t.my.cancelledInfo(b.cancelled_by === "admin", b.cancelled_at ? f.timestamp(b.cancelled_at) : "")}
          {b.cancel_reason && ` · ${translateReason(t, b.cancel_reason)}`}
        </p>
      )}
      {upcoming && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <a href={`/api/bookings/${b.code}/ics`} className="btn btn-ghost btn-sm">
            {t.my.addCalendar}
          </a>
          {canUserCancel(b) ? (
            <CancelDialog bookingId={b.id} summary={`${b.court_name} · ${f.dateLong(b.date)} · ${f.range(b.start_hour, b.end_hour)}`} />
          ) : (
            <span className="text-xs text-muted">{t.my.tooLate}</span>
          )}
        </div>
      )}
    </li>
  );
}

export default async function MyBookingsPage({ searchParams }: { searchParams: Promise<{ baru?: string }> }) {
  const user = await requireUser("/booking-saya");
  const { baru } = await searchParams;
  const { t, f } = await getI18n();
  const all = getUserBookings(user.id);
  const upcoming = all.filter((b) => b.status === "confirmed" && !isPast(b)).reverse();
  const history = all.filter((b) => b.status === "cancelled" || isPast(b));
  const created = baru ? upcoming.find((b) => b.code === baru) : undefined;
  const next = upcoming[0];

  return (
    <div className="container-page max-w-3xl pt-10">
      <p className="eyebrow">{t.my.eyebrow}</p>
      <h1 className="mt-2 text-4xl font-bold sm:text-5xl">{t.my.title}</h1>

      {created && (
        <div role="status" className="mt-6 rounded-2xl bg-court-900 p-5 text-cream">
          <p className="text-xs font-semibold uppercase tracking-widest text-ball">{t.my.successEyebrow}</p>
          <p className="mt-1 font-display text-xl font-semibold">
            {created.court_name}, {f.dateLong(created.date)} · {f.range(created.start_hour, created.end_hour)}
          </p>
          <p className="mt-1 text-sm text-cream/70">
            {t.my.codeLabel} <span className="font-mono font-semibold text-cream">{created.code}</span> {t.my.codeHint}
          </p>
        </div>
      )}

      {next && !created && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-court-200 bg-court-50 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-court-700">{t.my.nearest}</p>
            <p className="mt-1 font-display text-lg font-semibold">
              {next.court_name} · {f.countdown(slotMs(next.date, next.start_hour) - Date.now())}
            </p>
          </div>
          <p className="text-xs text-muted">
            {t.my.reminder}: {t.reminder.option(user.reminder_minutes).toLowerCase()} ·{" "}
            <Link href="/akun" className="font-semibold text-court-700 hover:underline">
              {t.my.change}
            </Link>
          </p>
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">{t.my.upcoming(upcoming.length)}</h2>
        {upcoming.length === 0 ? (
          <div className="card mt-4 p-8 text-center">
            <p className="text-muted">{t.my.emptyUpcoming}</p>
            <Link href="/booking" className="btn btn-primary mt-4">
              {t.my.seeSchedule}
            </Link>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {upcoming.map((b) => (
              <BookingCard key={b.id} b={b} upcoming t={t} f={f} />
            ))}
          </ul>
        )}
      </section>

      {history.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-semibold">{t.my.history}</h2>
          <ul className="mt-4 space-y-3">
            {history.slice(0, 20).map((b) => (
              <BookingCard key={b.id} b={b} upcoming={false} t={t} f={f} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
