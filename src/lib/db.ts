import "server-only";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { addDays, todayWIB } from "./time";

export type Role = "user" | "admin";

export type User = {
  id: number;
  name: string;
  email: string;
  phone: string;
  password_hash: string;
  role: Role;
  level: string;
  hand: string;
  backhand: string;
  city: string;
  bio: string;
  avatar_hue: number;
  avatar: string;
  password_changed_at: string | null;
  /** 1 = akun dibekukan admin: tidak bisa login, sesi yang ada langsung mati. */
  suspended: number;
  is_public: number;
  reminder_minutes: number;
  created_at: string;
};

export type Court = {
  id: number;
  name: string;
  surface: string;
  indoor: number;
  open_hour: number;
  close_hour: number;
  description: string;
  active: number;
};

export type Booking = {
  id: number;
  code: string;
  user_id: number;
  court_id: number;
  date: string;
  start_hour: number;
  end_hour: number;
  kind: "booking" | "block";
  status: "confirmed" | "cancelled";
  note: string;
  cancel_reason: string;
  cancelled_by: string;
  cancelled_at: string | null;
  created_at: string;
};

export type GalleryItem = {
  id: number;
  title: string;
  category: string;
  src: string;
  created_at: string;
};

// DATA_DIR bisa diarahkan ke volume persisten saat deploy (default: ./data di folder project).
export const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(process.cwd(), "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      level TEXT NOT NULL DEFAULT 'Pemula',
      hand TEXT NOT NULL DEFAULT 'Kanan',
      backhand TEXT NOT NULL DEFAULT 'Dua tangan',
      city TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      avatar_hue INTEGER NOT NULL DEFAULT 150,
      is_public INTEGER NOT NULL DEFAULT 1,
      reminder_minutes INTEGER NOT NULL DEFAULT 60,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS courts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      surface TEXT NOT NULL,
      indoor INTEGER NOT NULL DEFAULT 0,
      description TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      court_id INTEGER NOT NULL REFERENCES courts(id),
      date TEXT NOT NULL,
      start_hour INTEGER NOT NULL,
      end_hour INTEGER NOT NULL,
      kind TEXT NOT NULL DEFAULT 'booking',
      status TEXT NOT NULL DEFAULT 'confirmed',
      note TEXT NOT NULL DEFAULT '',
      cancel_reason TEXT NOT NULL DEFAULT '',
      cancelled_by TEXT NOT NULL DEFAULT '',
      cancelled_at TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_bookings_slot ON bookings(court_id, date, status);
    CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id, date);

    CREATE TABLE IF NOT EXISTS gallery (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Lapangan',
      src TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      used_at INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mm_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      play_date TEXT NOT NULL,
      location TEXT NOT NULL DEFAULT '',
      mode TEXT NOT NULL DEFAULT 'casual',
      format TEXT NOT NULL DEFAULT 'doubles',
      gender_rule TEXT NOT NULL DEFAULT 'any',
      target_score INTEGER NOT NULL DEFAULT 6,
      duration_minutes INTEGER NOT NULL DEFAULT 120,
      match_minutes INTEGER NOT NULL DEFAULT 20,
      courts_count INTEGER NOT NULL DEFAULT 1,
      target_plays INTEGER NOT NULL DEFAULT 0,
      finished INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE TABLE IF NOT EXISTS mm_players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES mm_sessions(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      gender TEXT NOT NULL DEFAULT 'M',
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS mm_matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES mm_sessions(id) ON DELETE CASCADE,
      round INTEGER NOT NULL,
      slot INTEGER NOT NULL,
      a1 INTEGER REFERENCES mm_players(id),
      a2 INTEGER REFERENCES mm_players(id),
      b1 INTEGER REFERENCES mm_players(id),
      b2 INTEGER REFERENCES mm_players(id),
      score_a INTEGER,
      score_b INTEGER,
      is_bye INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_mm_matches_session ON mm_matches(session_id, round, slot);
  `);

  // Migrasi aditif: database yang sudah berisi data tidak perlu di-reset saat ada kolom baru.
  const addColumn = (table: string, column: string, ddl: string) => {
    const cols = db.prepare(`SELECT name FROM pragma_table_info('${table}')`).all() as { name: string }[];
    if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  };
  addColumn("users", "avatar", "TEXT NOT NULL DEFAULT ''");
  addColumn("users", "password_changed_at", "TEXT");
  addColumn("courts", "open_hour", "INTEGER NOT NULL DEFAULT 6");
  addColumn("courts", "close_hour", "INTEGER NOT NULL DEFAULT 23");
  addColumn("mm_sessions", "open_edit", "INTEGER NOT NULL DEFAULT 1");
  addColumn("users", "suspended", "INTEGER NOT NULL DEFAULT 0");
  db.exec("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
}

export function newBookingCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `SNP-${s}`;
}

// Data awal supaya aplikasi langsung bisa dicoba. Hanya jalan saat database masih kosong.
function seed(db: Database.Database) {
  const run = db.transaction(() => {
    const { n } = db.prepare("SELECT COUNT(*) AS n FROM courts").get() as { n: number };
    if (n > 0) return;

    const insertCourt = db.prepare("INSERT INTO courts (name, surface, indoor, description) VALUES (?,?,?,?)");
    insertCourt.run("Sawangan", "Hard court", 0, "Lapangan tenis di Sawangan, Depok.");
    insertCourt.run("Ragunan", "Hard court", 0, "Lapangan tenis di Ragunan, Jakarta Selatan.");

    const insertUser = db.prepare(
      `INSERT INTO users (name, email, phone, password_hash, role, level, hand, backhand, city, bio, avatar_hue)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    );
    const adminHash = bcrypt.hashSync("admin123", 10);
    const userHash = bcrypt.hashSync("tenis123", 10);
    insertUser.run("Admin Sanapati", "admin@sanapati.id", "081200000001", adminHash, "admin", "Menengah", "Kanan", "Dua tangan", "Jakarta", "Pengelola Sanapati Tenis.", 150);
    const players: [string, string, string, string, string, string, string, number][] = [
      ["Raka Pratama", "raka@contoh.id", "Menengah", "Kanan", "Dua tangan", "Jakarta Selatan", "Main tiap Sabtu pagi. Suka reli panjang dari baseline, lagi belajar serve kick.", 18],
      ["Dinda Maharani", "dinda@contoh.id", "Mahir", "Kanan", "Satu tangan", "Depok", "Eks atlet junior. Main single maupun double.", 330],
      ["Bima Aditya", "bima@contoh.id", "Pemula", "Kiri", "Dua tangan", "Tangerang", "Baru mulai 6 bulan, masih semangat-semangatnya.", 210],
      ["Sekar Ayu", "sekar@contoh.id", "Menengah", "Kanan", "Dua tangan", "Jakarta Timur", "Spesialis double, net player.", 275],
      ["Yoga Santoso", "yoga@contoh.id", "Mahir", "Kiri", "Satu tangan", "Bekasi", "Serve and volley. Main malam sepulang kerja.", 45],
    ];
    players.forEach(([name, email, level, hand, backhand, city, bio, hue], i) =>
      insertUser.run(name, email, `08130000000${i + 1}`, userHash, "user", level, hand, backhand, city, bio, hue)
    );

    const insertGallery = db.prepare("INSERT INTO gallery (title, category, src) VALUES (?,?,?)");
    [
      ["Lapangan dari atas", "Lapangan", "/gallery/court-top.svg"],
      ["Garis baseline", "Lapangan", "/gallery/clay-lines.svg"],
      ["Sesi malam di bawah lampu", "Suasana", "/gallery/night-lights.svg"],
      ["Di balik net", "Suasana", "/gallery/net.svg"],
      ["Turnamen internal 2026", "Turnamen", "/gallery/tournament.svg"],
      ["Bola baru, semangat baru", "Komunitas", "/gallery/balls.svg"],
      ["Pagi di lapangan", "Lapangan", "/gallery/garden.svg"],
      ["Klinik akhir pekan", "Komunitas", "/gallery/clinic.svg"],
    ].forEach(([title, category, src]) => insertGallery.run(title, category, src));

    // Booking contoh: 3 minggu ke belakang + seminggu ke depan, deterministik.
    const insertBooking = db.prepare(
      "INSERT INTO bookings (code, user_id, court_id, date, start_hour, end_hour) VALUES (?,?,?,?,?,?)"
    );
    const overlap = db.prepare(
      "SELECT 1 FROM bookings WHERE court_id=? AND date=? AND start_hour < ? AND end_hour > ?"
    );
    const courts = db.prepare("SELECT * FROM courts").all() as Court[];
    let s = 20260918;
    const rand = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
    const today = todayWIB();
    // Sisakan ruang di bawah MAX_ACTIVE_BOOKINGS supaya akun demo tetap bisa mencoba booking.
    const upcomingPerUser = new Map<number, number>();
    for (let offset = -21; offset <= 6; offset++) {
      const date = addDays(today, offset);
      const count = 3 + Math.floor(rand() * 5);
      for (let k = 0; k < count; k++) {
        const court = courts[Math.floor(rand() * courts.length)];
        const start = [6, 7, 8, 9, 15, 16, 17, 18, 19, 20][Math.floor(rand() * 10)];
        const end = Math.min(22, start + 1 + Math.floor(rand() * 2));
        if (overlap.get(court.id, date, end, start)) continue;
        const userId = 2 + Math.floor(rand() * players.length);
        if (offset >= 0) {
          const n = upcomingPerUser.get(userId) ?? 0;
          if (n >= 2) continue;
          upcomingPerUser.set(userId, n + 1);
        }
        insertBooking.run(newBookingCode(), userId, court.id, date, start, end);
      }
    }
  });
  run.immediate();
}

const g = globalThis as unknown as { __sanapatiDb?: Database.Database };

function open(): Database.Database {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const db = new Database(path.join(DATA_DIR, "sanapati.db"), { timeout: 10000 });
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  seed(db);
  return db;
}

// Lazy: koneksi baru dibuka saat query pertama, bukan saat modul di-import.
// `next build` meng-import semua route di banyak worker sekaligus dan akan berebut lock file.
export const db = new Proxy({} as Database.Database, {
  get(_, prop) {
    const real = (g.__sanapatiDb ??= open());
    const value = real[prop as keyof Database.Database];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(real) : value;
  },
});
