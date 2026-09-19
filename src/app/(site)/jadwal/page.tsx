import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCourts } from "@/lib/bookings";
import { db } from "@/lib/db";
import { opt } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n-server";
import { addDays, isValidDate, todayWIB } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.calendar.metaTitle };
}

type Row = {
  court_id: number;
  date: string;
  start_hour: number;
  end_hour: number;
  kind: "booking" | "block";
  note: string;
  user_id: number;
  user_name: string;
  is_public: number;
};

const shiftMonth = (month: string, delta: number) => {
  const d = new Date(`${month}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 7);
};

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ bulan?: string; tanggal?: string }> }) {
  const sp = await searchParams;
  const { t, f, locale, rules } = await getI18n();
  const c = t.calendar;
  const me = await getCurrentUser();
  const courts = await getCourts();
  const today = todayWIB();

  const monthParam = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.bulan ?? "") ? sp.bulan! : "";
  const selected = isValidDate(sp.tanggal) ? sp.tanggal : !monthParam || monthParam === today.slice(0, 7) ? today : `${monthParam}-01`;
  const month = monthParam || selected.slice(0, 7);

  // Grid Senin–Minggu yang menutup seluruh bulan.
  const first = `${month}-01`;
  const lead = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const gridStart = addDays(first, -lead);
  const cells = Array.from({ length: Math.ceil((lead + daysInMonth) / 7) * 7 }, (_, i) => addDays(gridStart, i));

  const from = selected < gridStart ? selected : gridStart;
  const lastCell = cells[cells.length - 1];
  const to = selected > lastCell ? selected : lastCell;
  const rows = await db.all(`SELECT b.court_id, b.date, b.start_hour, b.end_hour, b.kind, b.note, b.user_id, u.name AS user_name, u.is_public
       FROM bookings b JOIN users u ON u.id = b.user_id
       WHERE b.status = 'confirmed' AND b.date BETWEEN ? AND ? ORDER BY b.date, b.start_hour`, from, to) as Row[];

  const byDay = new Map<string, Row[]>();
  for (const r of rows) byDay.set(r.date, [...(byDay.get(r.date) ?? []), r]);
  const bookedHours = (date: string, courtId: number) =>
    (byDay.get(date) ?? [])
      .filter((r) => r.court_id === courtId && r.kind === "booking")
      .reduce((sum, r) => sum + r.end_hour - r.start_hour, 0);

  const monthLabel = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${first}T12:00:00Z`)
  );
  const bookable = selected >= today && selected <= addDays(today, rules.maxDaysAhead);
  // Nama hanya ditampilkan untuk pemain yang profilnya publik.
  const who = (r: Row) => (r.user_id === me?.id ? c.you : r.is_public ? r.user_name : c.member);

  return (
    <div className="container-page pt-10">
      <p className="eyebrow">{c.eyebrow}</p>
      <h1 className="mt-2 text-4xl font-bold sm:text-5xl">{c.title}</h1>
      <p className="mt-3 max-w-xl text-muted">{c.lead}</p>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className="card p-3 sm:p-5" aria-label={monthLabel}>
          <div className="flex items-center justify-between gap-2 px-1 pb-4">
            <h2 className="text-xl font-semibold capitalize sm:text-2xl">{monthLabel}</h2>
            <div className="flex items-center gap-1.5">
              {month !== today.slice(0, 7) && (
                <Link href="/jadwal" scroll={false} className="btn btn-ghost btn-sm">
                  {c.thisMonth}
                </Link>
              )}
              <Link href={`/jadwal?bulan=${shiftMonth(month, -1)}`} scroll={false} aria-label={c.prev} className="btn btn-ghost btn-sm px-3">
                ←
              </Link>
              <Link href={`/jadwal?bulan=${shiftMonth(month, 1)}`} scroll={false} aria-label={c.next} className="btn btn-ghost btn-sm px-3">
                →
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-muted">
            {c.weekdays.map((w, i) => (
              <span key={w} className={i > 4 ? "text-clay-600" : ""}>
                {w}
              </span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((d) => {
              const inMonth = d.startsWith(month);
              const isSelected = d === selected;
              const total = courts.reduce((sum, court) => sum + bookedHours(d, court.id), 0);
              return (
                <Link
                  key={d}
                  href={`/jadwal?bulan=${d.slice(0, 7)}&tanggal=${d}`}
                  scroll={false}
                  aria-current={isSelected ? "date" : undefined}
                  aria-label={`${f.dateLong(d)} — ${c.booked(total)}`}
                  className={`flex min-h-16 flex-col rounded-xl border p-1.5 text-left transition sm:min-h-20 sm:p-2 ${
                    isSelected
                      ? "border-court-900 bg-court-900 text-cream"
                      : d === today
                        ? "border-court-600 bg-court-50 hover:border-court-900"
                        : "border-transparent bg-cream hover:border-court-700"
                  } ${inMonth ? "" : "opacity-40"}`}
                >
                  <span className="flex items-baseline justify-between">
                    <span className="font-display text-sm font-bold sm:text-base">{f.dayNum(d)}</span>
                    {total > 0 && <span className={`hidden text-[10px] tabular-nums sm:inline ${isSelected ? "text-cream/70" : "text-muted"}`}>{t.common.hours(total)}</span>}
                  </span>
                  {/* Satu bar per lapangan: panjang = porsi jam yang terisi hari itu. */}
                  <span className="mt-auto space-y-1" aria-hidden>
                    {courts.map((court) => {
                      const ratio = bookedHours(d, court.id) / Math.max(1, court.close_hour - court.open_hour);
                      return (
                        <span key={court.id} className={`block h-1.5 overflow-hidden rounded-full ${isSelected ? "bg-cream/20" : "bg-sand"}`}>
                          <span className={`block h-full rounded-full ${isSelected ? "bg-ball" : "bg-court-700"}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
                        </span>
                      );
                    })}
                  </span>
                </Link>
              );
            })}
          </div>
          <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-muted">
            {courts.map((court, i) => (
              <span key={court.id}>
                {i + 1}. {court.name}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              {c.legendLow}
              <span className="h-1.5 w-10 rounded-full bg-gradient-to-r from-sand to-court-700" />
              {c.legendHigh}
            </span>
          </p>
        </section>

        <section className="card p-5 lg:sticky lg:top-24" aria-label={c.dayTitle(f.dateLong(selected))}>
          <h2 className="text-xl font-semibold">{f.dateLong(selected)}</h2>
          {/* Dua kolom hanya saat panel selebar layar (sm–lg); di desktop panelnya sempit, jadi lapangan ditumpuk. */}
          <div className={`mt-4 grid gap-5 ${courts.length > 1 ? "sm:grid-cols-2 lg:grid-cols-1" : ""}`}>
            {courts.map((court) => {
              const items = (byDay.get(selected) ?? []).filter((r) => r.court_id === court.id);
              // Susun garis waktu: selang kosong di antara booking ditampilkan eksplisit.
              const timeline: { start: number; end: number; row?: Row }[] = [];
              let cursor = court.open_hour;
              for (const r of items) {
                if (r.start_hour > cursor) timeline.push({ start: cursor, end: r.start_hour });
                timeline.push({ start: r.start_hour, end: r.end_hour, row: r });
                cursor = Math.max(cursor, r.end_hour);
              }
              if (cursor < court.close_hour) timeline.push({ start: cursor, end: court.close_hour });
              return (
                <div key={court.id}>
                  <h3 className="font-display text-lg font-semibold">{court.name}</h3>
                  <p className="text-xs text-muted">
                    {c.openHours(f.hour(court.open_hour), f.hour(court.close_hour))} · {c.booked(bookedHours(selected, court.id))}
                  </p>
                  <ul className="mt-3 space-y-1.5 text-sm">
                    {timeline.map((seg) => (
                      <li
                        key={seg.start}
                        className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 ${
                          !seg.row
                            ? "border border-dashed border-court-200 text-court-700"
                            : seg.row.kind === "block"
                              ? "bg-sand text-muted"
                              : seg.row.user_id === me?.id
                                ? "bg-ball text-court-950"
                                : "bg-court-900 text-cream"
                        }`}
                      >
                        <span className="shrink-0 whitespace-nowrap tabular-nums">{f.range(seg.start, seg.end)}</span>
                        <span className="truncate font-medium" title={seg.row?.kind === "booking" ? who(seg.row) : undefined}>
                          {!seg.row ? c.free : seg.row.kind === "block" ? `${c.closed} · ${opt(t, seg.row.note)}` : who(seg.row)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          <div className="mt-5 border-t border-line pt-4">
            {bookable ? (
              <Link href={`/booking?tanggal=${selected}`} className="btn btn-primary w-full">
                {c.bookThisDay}
              </Link>
            ) : (
              <p className="text-xs text-muted">{c.notBookable}</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
