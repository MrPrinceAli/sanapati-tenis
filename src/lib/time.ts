// Semua jadwal memakai zona waktu klub (WIB), bukan zona waktu server/browser.
// Format tampilan (tanggal, jam, hitung mundur) ada di lib/i18n.ts karena tergantung bahasa.
export const TZ = "Asia/Jakarta";
export const TZ_OFFSET = "+07:00";

// Batas default; tiap lapangan bisa punya jam sendiri (courts.open_hour / close_hour) di dalam rentang ini.
export const OPEN_HOUR = 6;
export const CLOSE_HOUR = 23;
export const EARLIEST_HOUR = 5;
export const MAX_DURATION = 3;
export const MAX_DAYS_AHEAD = 14;
export const CANCEL_LIMIT_HOURS = 6;
export const MAX_ACTIVE_BOOKINGS = 5;

export const hourRange = (open: number, close: number) => Array.from({ length: Math.max(0, close - open) }, (_, i) => open + i);
export const HOURS = hourRange(OPEN_HOUR, CLOSE_HOUR);

const pad = (n: number) => String(n).padStart(2, "0");

export function todayWIB(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(now);
}

/** Jam sekarang menurut WIB (0–23). Server Vercel berjalan di UTC, jadi jangan pakai getHours(). */
export function hourWIB(now: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(now));
}

export function isValidDate(date: unknown): date is string {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(`${date}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function slotMs(date: string, hour: number): number {
  return Date.parse(`${date}T${pad(hour)}:00:00${TZ_OFFSET}`);
}

export function isWeekend(date: string): boolean {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}
