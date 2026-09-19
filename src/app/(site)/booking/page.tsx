import type { Metadata } from "next";
import Link from "next/link";
import { DateJump } from "@/components/DateJump";
import { ScheduleBoard, type SlotState } from "@/components/ScheduleBoard";
import { getCurrentUser } from "@/lib/auth";
import { getCourts, getDayBookings } from "@/lib/bookings";
import { getI18n } from "@/lib/i18n-server";
import { addDays, isValidDate, isWeekend, slotMs, todayWIB } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.schedule.metaTitle };
}

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ tanggal?: string }> }) {
  const { tanggal } = await searchParams;
  const { t, f, rules } = await getI18n();
  const today = todayWIB();
  const maxDate = addDays(today, rules.maxDaysAhead);
  // Tanpa pilihan eksplisit, lompat ke besok kalau slot terakhir hari ini sudah lewat.
  const courts = await getCourts();
  const lastSlot = Math.max(...courts.map((c) => c.close_hour)) - 1;
  const fallback = slotMs(today, lastSlot) <= Date.now() ? addDays(today, 1) : today;
  const date = isValidDate(tanggal) && tanggal >= today && tanggal <= maxDate ? tanggal : fallback;

  const user = await getCurrentUser();
  const busy: Record<number, Record<number, SlotState>> = {};
  for (const b of await getDayBookings(date)) {
    const state: SlotState = b.kind === "block" ? "block" : b.user_id === user?.id ? "mine" : "booked";
    for (let h = b.start_hour; h < b.end_hour; h++) (busy[b.court_id] ??= {})[h] = state;
  }

  // Seluruh jendela booking (hari ini s.d. batas hari yang diatur admin) ditampilkan dalam satu strip yang bisa digeser.
  const days = Array.from({ length: rules.maxDaysAhead + 1 }, (_, i) => addDays(today, i));

  return (
    <div className="container-page pt-10">
      <p className="eyebrow">{t.schedule.eyebrow}</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-4xl font-bold sm:text-5xl">{t.schedule.title}</h1>
        <DateJump value={date} min={today} max={maxDate} />
      </div>

      <nav aria-label={t.schedule.pickDate} className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {days.map((d) => {
          const selected = d === date;
          return (
            <Link
              key={d}
              href={`/booking?tanggal=${d}`}
              scroll={false}
              aria-current={selected ? "date" : undefined}
              className={`flex w-16 shrink-0 flex-col items-center rounded-2xl border py-2.5 transition ${
                selected ? "border-court-900 bg-court-900 text-cream" : "border-line bg-white hover:border-court-700"
              }`}
            >
              <span className={`text-[11px] font-semibold uppercase ${selected ? "text-ball" : isWeekend(d) ? "text-clay-600" : "text-muted"}`}>
                {d === today ? t.common.today : f.weekday(d)}
              </span>
              <span className="font-display text-xl font-bold">{f.dayNum(d)}</span>
              <span className={`text-[11px] ${selected ? "text-cream/70" : "text-muted"}`}>{f.month(d)}</span>
            </Link>
          );
        })}
      </nav>

      <p className="mt-6 text-sm text-muted">
        {t.schedule.showing} <strong className="text-ink">{f.dateLong(date)}</strong>
      </p>

      <ScheduleBoard
        key={date}
        date={date}
        courts={courts.map(({ id, name, surface, indoor, open_hour, close_hour }) => ({ id, name, surface, indoor, open_hour, close_hour }))}
        busy={busy}
        nowMs={Date.now()}
        loggedIn={!!user}
      />
    </div>
  );
}
