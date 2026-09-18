// Aturan booking yang bisa diubah admin dari /admin/pengaturan. Nilai di lib/time.ts hanya default awal.
import { CANCEL_LIMIT_HOURS, MAX_ACTIVE_BOOKINGS, MAX_DAYS_AHEAD, MAX_DURATION } from "./time";

export type Rules = {
  /** Booking paling jauh berapa hari ke depan. */
  maxDaysAhead: number;
  /** Maksimal jam per booking. */
  maxDuration: number;
  /** Pemain boleh membatalkan sendiri sampai berapa jam sebelum main. */
  cancelLimitHours: number;
  /** Maksimal booking aktif per pemain. */
  maxActiveBookings: number;
};

export const DEFAULT_RULES: Rules = {
  maxDaysAhead: MAX_DAYS_AHEAD,
  maxDuration: MAX_DURATION,
  cancelLimitHours: CANCEL_LIMIT_HOURS,
  maxActiveBookings: MAX_ACTIVE_BOOKINGS,
};

export const RULE_BOUNDS: Record<keyof Rules, readonly [number, number]> = {
  maxDaysAhead: [1, 90],
  maxDuration: [1, 8],
  cancelLimitHours: [0, 72],
  maxActiveBookings: [1, 50],
};

/** Admin membuat booking di luar jendela pemain, tapi tetap dibatasi supaya salah ketik tahun tidak lolos. */
export const ADMIN_MAX_DAYS_AHEAD = 365;
