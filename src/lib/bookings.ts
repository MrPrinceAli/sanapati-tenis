import "server-only";
import { db, newBookingCode, type Booking, type Court, type Tx, type User } from "./db";
import type { ErrorCode } from "./i18n";
import { ADMIN_MAX_DAYS_AHEAD } from "./rules";
import { getRules } from "./settings";
import { addDays, isValidDate, slotMs, todayWIB } from "./time";

export type BookingRow = Booking & {
  court_name: string;
  surface: string;
  indoor: number;
  user_name: string;
  user_email: string;
  user_phone: string;
};

const JOINED = `
  SELECT b.*, c.name AS court_name, c.surface, c.indoor,
         u.name AS user_name, u.email AS user_email, u.phone AS user_phone
  FROM bookings b
  JOIN courts c ON c.id = b.court_id
  JOIN users u ON u.id = b.user_id`;

// Membawa kode, bukan kalimat: action yang menerjemahkannya sesuai bahasa user.
export class BookingError extends Error {
  constructor(public code: ErrorCode) {
    super(code);
  }
}

export const getCourts = (onlyActive = true) =>
  db.all<Court>(`SELECT * FROM courts ${onlyActive ? "WHERE active = 1" : ""} ORDER BY id`);

export const getDayBookings = (date: string) =>
  db.all<Booking>("SELECT * FROM bookings WHERE date = ? AND status = 'confirmed' ORDER BY start_hour", date);

export const getUserBookings = (userId: number) =>
  db.all<BookingRow>(`${JOINED} WHERE b.user_id = ? AND b.kind = 'booking' ORDER BY b.date DESC, b.start_hour DESC`, userId);

export const getBookingByCode = (code: string) => db.get<BookingRow>(`${JOINED} WHERE b.code = ?`, code);

export async function getUpcomingForUser(userId: number, withinHours = 48): Promise<BookingRow[]> {
  const today = todayWIB();
  const now = Date.now();
  const rows = await db.all<BookingRow>(
    `${JOINED} WHERE b.user_id = ? AND b.kind = 'booking' AND b.status = 'confirmed'
       AND b.date BETWEEN ? AND ? ORDER BY b.date, b.start_hour`,
    userId,
    today,
    addDays(today, Math.ceil(withinHours / 24) + 1)
  );
  return rows.filter((b) => {
    const endsAt = slotMs(b.date, b.end_hour);
    const startsAt = slotMs(b.date, b.start_hour);
    return endsAt > now && startsAt - now <= withinHours * 3600_000;
  });
}

export const isPast = (b: Pick<Booking, "date" | "end_hour">) => slotMs(b.date, b.end_hour) <= Date.now();

/** Sinkron (dipakai saat merender daftar): batas jamnya dioper dari `rules` yang sudah dimuat pemanggil. */
export function canUserCancel(b: Pick<Booking, "date" | "start_hour" | "status">, cancelLimitHours: number): boolean {
  return b.status === "confirmed" && slotMs(b.date, b.start_hour) - Date.now() >= cancelLimitHours * 3600_000;
}

type CreateInput = {
  user: User;
  courtId: number;
  date: string;
  start: number;
  end: number;
  note?: string;
  kind?: "booking" | "block";
  /** Admin membuat booking atas nama pemain: aturan pemain (jendela hari, maks jam, maks booking aktif) tidak berlaku. */
  bypassRules?: boolean;
};

const clashes = async (t: Tx, courtId: number, date: string, start: number, end: number, exceptId = 0) =>
  !!(await t.get(
    "SELECT 1 AS x FROM bookings WHERE court_id = ? AND date = ? AND status = 'confirmed' AND start_hour < ? AND end_hour > ? AND id != ?",
    courtId,
    date,
    end,
    start,
    exceptId
  ));

export async function createBooking({ user, courtId, date, start, end, note = "", kind = "booking", bypassRules = false }: CreateInput): Promise<Booking> {
  const rules = await getRules();
  const free = bypassRules || kind === "block";
  if (!isValidDate(date)) throw new BookingError("invalidDate");
  if (!Number.isInteger(start) || !Number.isInteger(end) || start >= end) throw new BookingError("outsideHours");
  const today = todayWIB();
  if (date < today || date > addDays(today, free ? ADMIN_MAX_DAYS_AHEAD : rules.maxDaysAhead)) throw new BookingError("tooFarAhead");
  if (slotMs(date, start) <= Date.now()) throw new BookingError("past");
  if (!free && end - start > rules.maxDuration) throw new BookingError("maxDuration");

  // Cek bentrok + insert dalam SATU transaksi tulis: database menserialkan transaksi tulis,
  // jadi dua orang yang menekan tombol bersamaan tidak bisa sama-sama lolos (anti double-booking).
  return db.tx(async (t) => {
    const court = await t.get<Court>("SELECT * FROM courts WHERE id = ? AND active = 1", courtId);
    if (!court) throw new BookingError("courtUnavailable");
    if (start < court.open_hour || end > court.close_hour) throw new BookingError("outsideHours");
    if (await clashes(t, courtId, date, start, end)) throw new BookingError("slotTaken");

    if (!free && user.role !== "admin") {
      const active = await t.get<{ n: number }>(
        "SELECT COUNT(*) AS n FROM bookings WHERE user_id = ? AND kind = 'booking' AND status = 'confirmed' AND date >= ?",
        user.id,
        today
      );
      if ((active?.n ?? 0) >= rules.maxActiveBookings) throw new BookingError("maxActive");
    }

    const info = await t.run(
      "INSERT INTO bookings (code, user_id, court_id, date, start_hour, end_hour, kind, note) VALUES (?,?,?,?,?,?,?,?)",
      newBookingCode(),
      user.id,
      courtId,
      date,
      start,
      end,
      kind,
      note.slice(0, 300)
    );
    return (await t.get<Booking>("SELECT * FROM bookings WHERE id = ?", info.lastInsertRowid))!;
  });
}

export async function cancelBooking(bookingId: number, actor: User, reason: string): Promise<Booking> {
  const booking = await db.get<Booking>("SELECT * FROM bookings WHERE id = ?", bookingId);
  if (!booking) throw new BookingError("notFound");
  const isAdmin = actor.role === "admin";
  if (!isAdmin && booking.user_id !== actor.id) throw new BookingError("notFound");
  if (booking.status === "cancelled") throw new BookingError("alreadyCancelled");
  if (isPast(booking)) throw new BookingError("pastCancel");
  if (!isAdmin && !canUserCancel(booking, (await getRules()).cancelLimitHours)) throw new BookingError("cancelTooLate");

  await db.run(
    `UPDATE bookings SET status = 'cancelled', cancel_reason = ?, cancelled_by = ?,
     cancelled_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
    reason.slice(0, 300),
    isAdmin && booking.user_id !== actor.id ? "admin" : "user",
    bookingId
  );
  return { ...booking, status: "cancelled" };
}

// ---- Kontrol penuh admin: pindah jadwal, pulihkan, hapus permanen ----

export async function moveBooking(bookingId: number, to: { courtId: number; date: string; start: number; end: number; note: string }): Promise<void> {
  if (!isValidDate(to.date)) throw new BookingError("invalidDate");
  if (!Number.isInteger(to.start) || !Number.isInteger(to.end) || to.start >= to.end) throw new BookingError("outsideHours");
  await db.tx(async (t) => {
    const booking = await t.get<Booking>("SELECT * FROM bookings WHERE id = ? AND kind = 'booking'", bookingId);
    if (!booking) throw new BookingError("notFound");
    const court = await t.get<Court>("SELECT * FROM courts WHERE id = ?", to.courtId);
    if (!court) throw new BookingError("courtUnavailable");
    if (to.start < court.open_hour || to.end > court.close_hour) throw new BookingError("outsideHours");
    if (booking.status === "confirmed" && (await clashes(t, to.courtId, to.date, to.start, to.end, bookingId))) throw new BookingError("slotTaken");
    await t.run(
      "UPDATE bookings SET court_id = ?, date = ?, start_hour = ?, end_hour = ?, note = ? WHERE id = ?",
      to.courtId,
      to.date,
      to.start,
      to.end,
      to.note.slice(0, 300),
      bookingId
    );
  });
}

export async function restoreBooking(bookingId: number): Promise<void> {
  await db.tx(async (t) => {
    const b = await t.get<Booking>("SELECT * FROM bookings WHERE id = ? AND kind = 'booking'", bookingId);
    if (!b) throw new BookingError("notFound");
    if (b.status === "confirmed") return;
    // Slotnya bisa saja sudah diambil orang lain sejak dibatalkan.
    if (await clashes(t, b.court_id, b.date, b.start_hour, b.end_hour, b.id)) throw new BookingError("slotTaken");
    await t.run("UPDATE bookings SET status = 'confirmed', cancel_reason = '', cancelled_by = '', cancelled_at = NULL WHERE id = ?", b.id);
  });
}

export const deleteBooking = (bookingId: number) => db.run("DELETE FROM bookings WHERE id = ? AND kind = 'booking'", bookingId);

export type PlayerStats = {
  sessions: number;
  hours: number;
  favoriteCourt: string | null;
  lastPlayed: string | null;
};

export async function getPlayerStats(userId: number): Promise<PlayerStats> {
  const today = todayWIB();
  const agg = await db.get<{ sessions: number; hours: number; lastPlayed: string | null }>(
    `SELECT COUNT(*) AS sessions, COALESCE(SUM(end_hour - start_hour), 0) AS hours, MAX(date) AS lastPlayed
       FROM bookings WHERE user_id = ? AND kind = 'booking' AND status = 'confirmed' AND date < ?`,
    userId,
    today
  );
  const fav = await db.get<{ name: string }>(
    `SELECT c.name FROM bookings b JOIN courts c ON c.id = b.court_id
       WHERE b.user_id = ? AND b.kind = 'booking' AND b.status = 'confirmed' AND b.date < ?
       GROUP BY b.court_id ORDER BY SUM(b.end_hour - b.start_hour) DESC LIMIT 1`,
    userId,
    today
  );
  return { sessions: agg?.sessions ?? 0, hours: agg?.hours ?? 0, lastPlayed: agg?.lastPlayed ?? null, favoriteCourt: fav?.name ?? null };
}
