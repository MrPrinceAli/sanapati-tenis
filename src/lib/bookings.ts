import "server-only";
import { db, newBookingCode, type Booking, type Court, type User } from "./db";
import type { ErrorCode } from "./i18n";
import { ADMIN_MAX_DAYS_AHEAD } from "./rules";
import { getRules } from "./settings";
import {
  addDays,
  isValidDate,
  slotMs,
  todayWIB,
} from "./time";

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

export function getCourts(onlyActive = true): Court[] {
  return db
    .prepare(`SELECT * FROM courts ${onlyActive ? "WHERE active = 1" : ""} ORDER BY id`)
    .all() as Court[];
}

export function getDayBookings(date: string): Booking[] {
  return db
    .prepare("SELECT * FROM bookings WHERE date = ? AND status = 'confirmed' ORDER BY start_hour")
    .all(date) as Booking[];
}

export function getUserBookings(userId: number): BookingRow[] {
  return db
    .prepare(`${JOINED} WHERE b.user_id = ? AND b.kind = 'booking' ORDER BY b.date DESC, b.start_hour DESC`)
    .all(userId) as BookingRow[];
}

export function getBookingByCode(code: string): BookingRow | undefined {
  return db.prepare(`${JOINED} WHERE b.code = ?`).get(code) as BookingRow | undefined;
}

export function getUpcomingForUser(userId: number, withinHours = 48): BookingRow[] {
  const today = todayWIB();
  const now = Date.now();
  const rows = db
    .prepare(
      `${JOINED} WHERE b.user_id = ? AND b.kind = 'booking' AND b.status = 'confirmed'
       AND b.date BETWEEN ? AND ? ORDER BY b.date, b.start_hour`
    )
    .all(userId, today, addDays(today, Math.ceil(withinHours / 24) + 1)) as BookingRow[];
  return rows.filter((b) => {
    const endsAt = slotMs(b.date, b.end_hour);
    const startsAt = slotMs(b.date, b.start_hour);
    return endsAt > now && startsAt - now <= withinHours * 3600_000;
  });
}

export const isPast = (b: Pick<Booking, "date" | "end_hour">) => slotMs(b.date, b.end_hour) <= Date.now();

export function canUserCancel(b: Pick<Booking, "date" | "start_hour" | "status">): boolean {
  return b.status === "confirmed" && slotMs(b.date, b.start_hour) - Date.now() >= getRules().cancelLimitHours * 3600_000;
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

export function createBooking({ user, courtId, date, start, end, note = "", kind = "booking", bypassRules = false }: CreateInput): Booking {
  const rules = getRules();
  const free = bypassRules || kind === "block";
  if (!isValidDate(date)) throw new BookingError("invalidDate");
  if (!Number.isInteger(start) || !Number.isInteger(end) || start >= end) throw new BookingError("outsideHours");
  const today = todayWIB();
  if (date < today || date > addDays(today, free ? ADMIN_MAX_DAYS_AHEAD : rules.maxDaysAhead)) {
    throw new BookingError("tooFarAhead");
  }
  if (slotMs(date, start) <= Date.now()) throw new BookingError("past");
  if (!free && end - start > rules.maxDuration) {
    throw new BookingError("maxDuration");
  }

  // better-sqlite3 sinkron, jadi cek bentrok + insert dalam satu transaksi aman dari double-booking.
  const tx = db.transaction((): Booking => {
    const court = db.prepare("SELECT * FROM courts WHERE id = ? AND active = 1").get(courtId) as Court | undefined;
    if (!court) throw new BookingError("courtUnavailable");
    if (start < court.open_hour || end > court.close_hour) throw new BookingError("outsideHours");

    const clash = db
      .prepare(
        "SELECT 1 FROM bookings WHERE court_id = ? AND date = ? AND status = 'confirmed' AND start_hour < ? AND end_hour > ?"
      )
      .get(courtId, date, end, start);
    if (clash) throw new BookingError("slotTaken");

    if (!free) {
      const active = db
        .prepare(
          "SELECT COUNT(*) AS n FROM bookings WHERE user_id = ? AND kind = 'booking' AND status = 'confirmed' AND date >= ?"
        )
        .get(user.id, today) as { n: number };
      if (active.n >= rules.maxActiveBookings && user.role !== "admin") {
        throw new BookingError("maxActive");
      }
    }

    const info = db
      .prepare(
        `INSERT INTO bookings (code, user_id, court_id, date, start_hour, end_hour, kind, note)
         VALUES (?,?,?,?,?,?,?,?)`
      )
      .run(newBookingCode(), user.id, courtId, date, start, end, kind, note.slice(0, 300));
    return db.prepare("SELECT * FROM bookings WHERE id = ?").get(info.lastInsertRowid) as Booking;
  });
  return tx.immediate();
}

export function cancelBooking(bookingId: number, actor: User, reason: string): Booking {
  const booking = db.prepare("SELECT * FROM bookings WHERE id = ?").get(bookingId) as Booking | undefined;
  if (!booking) throw new BookingError("notFound");
  const isAdmin = actor.role === "admin";
  if (!isAdmin && booking.user_id !== actor.id) throw new BookingError("notFound");
  if (booking.status === "cancelled") throw new BookingError("alreadyCancelled");
  if (isPast(booking)) throw new BookingError("pastCancel");
  if (!isAdmin && !canUserCancel(booking)) {
    throw new BookingError("cancelTooLate");
  }
  db.prepare(
    `UPDATE bookings SET status = 'cancelled', cancel_reason = ?, cancelled_by = ?,
     cancelled_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`
  ).run(reason.slice(0, 300), isAdmin && booking.user_id !== actor.id ? "admin" : "user", bookingId);
  return { ...booking, status: "cancelled" };
}

// ---- Kontrol penuh admin: pindah jadwal, pulihkan, hapus permanen ----

const clashes = (courtId: number, date: string, start: number, end: number, exceptId: number) =>
  !!db
    .prepare(
      "SELECT 1 FROM bookings WHERE court_id = ? AND date = ? AND status = 'confirmed' AND start_hour < ? AND end_hour > ? AND id != ?"
    )
    .get(courtId, date, end, start, exceptId);

export function moveBooking(bookingId: number, to: { courtId: number; date: string; start: number; end: number; note: string }): void {
  if (!isValidDate(to.date)) throw new BookingError("invalidDate");
  if (!Number.isInteger(to.start) || !Number.isInteger(to.end) || to.start >= to.end) throw new BookingError("outsideHours");
  db.transaction(() => {
    const booking = db.prepare("SELECT * FROM bookings WHERE id = ? AND kind = 'booking'").get(bookingId) as Booking | undefined;
    if (!booking) throw new BookingError("notFound");
    const court = db.prepare("SELECT * FROM courts WHERE id = ?").get(to.courtId) as Court | undefined;
    if (!court) throw new BookingError("courtUnavailable");
    if (to.start < court.open_hour || to.end > court.close_hour) throw new BookingError("outsideHours");
    if (booking.status === "confirmed" && clashes(to.courtId, to.date, to.start, to.end, bookingId)) throw new BookingError("slotTaken");
    db.prepare("UPDATE bookings SET court_id = ?, date = ?, start_hour = ?, end_hour = ?, note = ? WHERE id = ?").run(
      to.courtId,
      to.date,
      to.start,
      to.end,
      to.note.slice(0, 300),
      bookingId
    );
  }).immediate();
}

export function restoreBooking(bookingId: number): void {
  db.transaction(() => {
    const b = db.prepare("SELECT * FROM bookings WHERE id = ? AND kind = 'booking'").get(bookingId) as Booking | undefined;
    if (!b) throw new BookingError("notFound");
    if (b.status === "confirmed") return;
    // Slotnya bisa saja sudah diambil orang lain sejak dibatalkan.
    if (clashes(b.court_id, b.date, b.start_hour, b.end_hour, b.id)) throw new BookingError("slotTaken");
    db.prepare("UPDATE bookings SET status = 'confirmed', cancel_reason = '', cancelled_by = '', cancelled_at = NULL WHERE id = ?").run(b.id);
  }).immediate();
}

export function deleteBooking(bookingId: number): void {
  db.prepare("DELETE FROM bookings WHERE id = ? AND kind = 'booking'").run(bookingId);
}

export type PlayerStats = {
  sessions: number;
  hours: number;
  favoriteCourt: string | null;
  lastPlayed: string | null;
};

export function getPlayerStats(userId: number): PlayerStats {
  const today = todayWIB();
  const agg = db
    .prepare(
      `SELECT COUNT(*) AS sessions, COALESCE(SUM(end_hour - start_hour), 0) AS hours, MAX(date) AS lastPlayed
       FROM bookings WHERE user_id = ? AND kind = 'booking' AND status = 'confirmed' AND date < ?`
    )
    .get(userId, today) as { sessions: number; hours: number; lastPlayed: string | null };
  const fav = db
    .prepare(
      `SELECT c.name FROM bookings b JOIN courts c ON c.id = b.court_id
       WHERE b.user_id = ? AND b.kind = 'booking' AND b.status = 'confirmed' AND b.date < ?
       GROUP BY b.court_id ORDER BY SUM(b.end_hour - b.start_hour) DESC LIMIT 1`
    )
    .get(userId, today) as { name: string } | undefined;
  return { ...agg, favoriteCourt: fav?.name ?? null };
}
