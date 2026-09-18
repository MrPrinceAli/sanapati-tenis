import Link from "next/link";
import { BarChart } from "@/components/admin/BarChart";
import { getCourts } from "@/lib/bookings";
import { db } from "@/lib/db";
import { opt } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n-server";
import { addDays, todayWIB } from "@/lib/time";

type TodayRow = {
  id: number;
  code: string;
  kind: string;
  start_hour: number;
  end_hour: number;
  note: string;
  court_name: string;
  user_name: string;
};

export default async function AdminOverview() {
  const { t, f } = await getI18n();
  const o = t.admin.overview;
  const today = todayWIB();
  const month = `${today.slice(0, 7)}-%`;
  const courts = getCourts();
  const capacityToday = courts.reduce((sum, c) => sum + c.close_hour - c.open_hour, 0);

  const one = <T,>(sql: string, ...args: unknown[]) => db.prepare(sql).get(...args) as T;
  const todayAgg = one<{ n: number; hours: number }>(
    "SELECT COUNT(*) AS n, COALESCE(SUM(end_hour - start_hour), 0) AS hours FROM bookings WHERE date = ? AND status = 'confirmed' AND kind = 'booking'",
    today
  );
  const monthAgg = one<{ confirmed: number; cancelled: number }>(
    `SELECT COUNT(CASE WHEN status = 'confirmed' THEN 1 END) AS confirmed,
            COUNT(CASE WHEN status = 'cancelled' THEN 1 END) AS cancelled
     FROM bookings WHERE date LIKE ? AND kind = 'booking'`,
    month
  );
  const members = one<{ n: number; fresh: number }>(
    "SELECT COUNT(*) AS n, COUNT(CASE WHEN created_at LIKE ? THEN 1 END) AS fresh FROM users WHERE role = 'user'",
    month
  );

  const from = addDays(today, -13);
  const perDay = new Map(
    (
      db
        .prepare(
          `SELECT date, SUM(end_hour - start_hour) AS hours FROM bookings
           WHERE date BETWEEN ? AND ? AND status = 'confirmed' AND kind = 'booking' GROUP BY date`
        )
        .all(from, today) as { date: string; hours: number }[]
    ).map((r) => [r.date, r.hours])
  );
  const chart = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(from, i);
    return { key: d, label: f.dayNum(d), longLabel: f.dateShort(d), value: perDay.get(d) ?? 0 };
  });

  const perCourt = db
    .prepare(
      `SELECT c.id, c.name, c.close_hour - c.open_hour AS capacity, COALESCE(SUM(b.end_hour - b.start_hour), 0) AS hours FROM courts c
       LEFT JOIN bookings b ON b.court_id = c.id AND b.date BETWEEN ? AND ? AND b.status = 'confirmed' AND b.kind = 'booking'
       WHERE c.active = 1 GROUP BY c.id ORDER BY c.id`
    )
    .all(addDays(today, -6), today) as { id: number; name: string; capacity: number; hours: number }[];

  const schedule = db
    .prepare(
      `SELECT b.id, b.code, b.kind, b.start_hour, b.end_hour, b.note, c.name AS court_name, u.name AS user_name
       FROM bookings b JOIN courts c ON c.id = b.court_id JOIN users u ON u.id = b.user_id
       WHERE b.date = ? AND b.status = 'confirmed' ORDER BY b.start_hour, c.id`
    )
    .all(today) as TodayRow[];

  const tiles = [
    { label: o.tileToday, value: String(todayAgg.n), sub: o.tileTodaySub(todayAgg.hours) },
    {
      label: o.tileOcc,
      value: `${capacityToday ? Math.round((todayAgg.hours / capacityToday) * 100) : 0}%`,
      sub: o.tileOccSub(capacityToday),
    },
    { label: o.tileMonth, value: String(monthAgg.confirmed), sub: o.tileMonthSub(monthAgg.cancelled) },
    { label: o.tileMembers, value: String(members.n), sub: o.tileMembersSub(members.fresh) },
  ];

  return (
    <>
      <p className="eyebrow">{t.admin.tabs.overview}</p>
      <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{f.dateLong(today)}</h1>

      <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="card p-5">
            <dt className="text-xs font-medium text-muted">{tile.label}</dt>
            <dd className="mt-2 font-display text-2xl font-bold tabular-nums sm:text-3xl">{tile.value}</dd>
            <dd className="mt-1 text-xs text-muted">{tile.sub}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <section className="card p-6">
          <h2 className="text-lg font-semibold">{o.chartTitle}</h2>
          <p className="text-xs text-muted">{o.chartSub}</p>
          <div className="mt-6">
            <BarChart data={chart} unit={o.unitHours} tableLabel={o.tableView} />
          </div>
        </section>

        <section className="card p-6">
          <h2 className="text-lg font-semibold">{o.occTitle}</h2>
          <p className="text-xs text-muted">{o.occSub}</p>
          <ul className="mt-5 space-y-4">
            {perCourt.map((c) => {
              const pct = Math.round((c.hours / (c.capacity * 7)) * 100);
              return (
                <li key={c.id}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{c.name}</span>
                    <span className="tabular-nums text-muted">
                      {t.common.hours(c.hours)} · {pct}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-sand" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={o.occAria(c.name)}>
                    <div className="h-full rounded-full bg-court-700" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <section className="card mt-4 overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-6 pb-4">
          <h2 className="text-lg font-semibold">{o.todayTitle}</h2>
          <Link href={`/admin/booking?tanggal=${today}`} className="text-sm font-semibold text-court-700 hover:underline">
            {o.manage}
          </Link>
        </div>
        {schedule.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted">{o.noToday}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="border-y border-line bg-cream text-xs text-muted">
                <tr>
                  <th className="px-6 py-2.5 font-medium">{o.colTime}</th>
                  <th className="px-3 py-2.5 font-medium">{o.colCourt}</th>
                  <th className="px-3 py-2.5 font-medium">{o.colPlayer}</th>
                  <th className="px-3 py-2.5 font-medium">{o.colCode}</th>
                  <th className="px-6 py-2.5 font-medium">{o.colNote}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {schedule.map((b) => (
                  <tr key={b.id}>
                    <td className="px-6 py-3 font-medium tabular-nums">{f.range(b.start_hour, b.end_hour)}</td>
                    <td className="px-3 py-3">{b.court_name}</td>
                    <td className="px-3 py-3">
                      {b.kind === "block" ? <span className="text-muted">{o.blocked(opt(t, b.note))}</span> : b.user_name}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-muted">{b.kind === "block" ? "—" : b.code}</td>
                    <td className="px-6 py-3 text-muted">{b.kind === "block" ? "—" : b.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
