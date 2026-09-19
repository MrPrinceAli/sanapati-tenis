import "server-only";
import { db, type RecurringBlock } from "./db";

/** Hari dalam seminggu untuk sebuah tanggal, ISO: 1 = Senin … 7 = Minggu. */
export const weekdayOf = (date: string) => (((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1);

export const getRecurringBlocks = (onlyActive = true) =>
  db.all<RecurringBlock>(
    `SELECT * FROM recurring_blocks ${onlyActive ? "WHERE active = 1" : ""} ORDER BY weekday, start_hour, court_id`
  );

/** Jam-jam yang tertutup oleh jadwal rutin pada satu tanggal & lapangan. */
export function recurringHours(rules: RecurringBlock[], courtId: number, date: string): Set<number> {
  const wd = weekdayOf(date);
  const hours = new Set<number>();
  for (const r of rules) {
    if (r.court_id !== courtId || r.weekday !== wd) continue;
    for (let h = r.start_hour; h < r.end_hour; h++) hours.add(h);
  }
  return hours;
}

/** Aturan pertama yang bentrok dengan rentang [start, end) — dipakai untuk menolak booking baru. */
export function findRecurringClash(
  rules: RecurringBlock[],
  courtId: number,
  date: string,
  start: number,
  end: number
): RecurringBlock | undefined {
  const wd = weekdayOf(date);
  return rules.find((r) => r.court_id === courtId && r.weekday === wd && r.start_hour < end && r.end_hour > start);
}
