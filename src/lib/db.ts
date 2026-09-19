import "server-only";
import type { Client, InArgs, InStatement, ResultSet, Transaction } from "@libsql/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
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

/** Jadwal rutin mingguan: satu baris = satu hari dalam seminggu yang selalu tertutup di lapangan itu. */
export type RecurringBlock = {
  id: number;
  court_id: number;
  /** ISO: 1 = Senin … 7 = Minggu. */
  weekday: number;
  start_hour: number;
  end_hour: number;
  note: string;
  active: number;
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

/**
 * Database: Turso (SQLite di cloud) bila TURSO_DATABASE_URL diisi — wajib di hosting serverless seperti Vercel yang
 * sistem file-nya read-only — atau file SQLite lokal di DATA_DIR untuk development / server dengan disk sendiri.
 */
const REMOTE_URL = process.env.TURSO_DATABASE_URL;

// Naikkan angka ini setiap kali SCHEMA atau daftar kolom di bawah berubah.
const SCHEMA_VERSION = "6";

const SCHEMA = `
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

    CREATE TABLE IF NOT EXISTS recurring_blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      court_id INTEGER NOT NULL REFERENCES courts(id),
      weekday INTEGER NOT NULL,
      start_hour INTEGER NOT NULL,
      end_hour INTEGER NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

// Kolom yang ditambahkan setelah rilis pertama. Migrasi selalu aditif: data yang sudah ada tidak pernah di-reset.
const ADDED_COLUMNS: [table: string, column: string, ddl: string][] = [
  ["users", "avatar", "TEXT NOT NULL DEFAULT ''"],
  ["users", "password_changed_at", "TEXT"],
  ["users", "suspended", "INTEGER NOT NULL DEFAULT 0"],
  ["courts", "open_hour", "INTEGER NOT NULL DEFAULT 6"],
  ["courts", "close_hour", "INTEGER NOT NULL DEFAULT 23"],
  ["mm_sessions", "open_edit", "INTEGER NOT NULL DEFAULT 1"],
];

export function newBookingCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `SNP-${s}`;
}

async function migrate(client: Client) {
  // Jalur cepat: satu query saja saat skema sudah terbaru (penting untuk cold start di serverless).
  try {
    const v = await client.execute("SELECT value FROM meta WHERE key = 'schema_version'");
    if (v.rows[0]?.[0] === SCHEMA_VERSION) return;
  } catch {
    /* tabel meta belum ada: database baru */
  }
  // Satu batch atomik. Skema tidak punya trigger, jadi aman dipecah per titik koma.
  await client.batch(
    SCHEMA.split(";")
      .map((q) => q.trim())
      .filter(Boolean),
    "write"
  );
  // "Tambah kolom, abaikan kalau sudah ada" — sengaja tidak memakai pragma_table_info(),
  // karena fungsi PRAGMA bernilai-tabel tidak selalu diizinkan di server database terkelola.
  for (const [table, column, ddl] of ADDED_COLUMNS) {
    try {
      await client.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
    } catch (e) {
      if (!/duplicate column/i.test(String((e as Error)?.message ?? e))) throw e;
    }
  }
  await client.execute({
    sql: "INSERT INTO meta (key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    args: [SCHEMA_VERSION],
  });
}

// Data awal, hanya saat database masih kosong. Akun & booking contoh TIDAK dibuat di produksi.
async function seed(client: Client) {
  const count = await client.execute("SELECT COUNT(*) FROM courts");
  if (Number(count.rows[0][0]) > 0) return;

  const production = process.env.NODE_ENV === "production";
  const withDemo = !production || process.env.SEED_DEMO === "1";
  // Di produksi password admin tidak boleh yang tertulis di kode (repo ini publik).
  let adminPassword = process.env.ADMIN_PASSWORD || (production ? "" : "admin123");
  if (!adminPassword) {
    adminPassword = randomBytes(9).toString("base64url");
    console.warn(`[seed] ADMIN_PASSWORD tidak diatur. Password admin sementara: ${adminPassword} — segera ganti dari halaman admin.`);
  }

  const stmts: InStatement[] = [
    { sql: "INSERT INTO courts (name, surface, indoor, description) VALUES (?,?,?,?)", args: ["Sawangan", "Hard court", 0, "Lapangan tenis di Sawangan, Depok."] },
    { sql: "INSERT INTO courts (name, surface, indoor, description) VALUES (?,?,?,?)", args: ["Ragunan", "Hard court", 0, "Lapangan tenis di Ragunan, Jakarta Selatan."] },
  ];
  const insertUser = `INSERT INTO users (name, email, phone, password_hash, role, level, hand, backhand, city, bio, avatar_hue)
                      VALUES (?,?,?,?,?,?,?,?,?,?,?)`;
  stmts.push({
    sql: insertUser,
    args: ["Admin Sanapati", process.env.ADMIN_EMAIL || "admin@sanapati.id", "081200000001", bcrypt.hashSync(adminPassword, 10), "admin", "Menengah", "Kanan", "Dua tangan", "Jakarta", "Pengelola Sanapati Tenis.", 150],
  });
  for (const [title, category, src] of [
    ["Lapangan dari atas", "Lapangan", "/gallery/court-top.svg"],
    ["Garis baseline", "Lapangan", "/gallery/clay-lines.svg"],
    ["Sesi malam di bawah lampu", "Suasana", "/gallery/night-lights.svg"],
    ["Di balik net", "Suasana", "/gallery/net.svg"],
    ["Turnamen internal 2026", "Turnamen", "/gallery/tournament.svg"],
    ["Bola baru, semangat baru", "Komunitas", "/gallery/balls.svg"],
    ["Pagi di lapangan", "Lapangan", "/gallery/garden.svg"],
    ["Klinik akhir pekan", "Komunitas", "/gallery/clinic.svg"],
  ]) {
    stmts.push({ sql: "INSERT INTO gallery (title, category, src) VALUES (?,?,?)", args: [title, category, src] });
  }

  if (withDemo) {
    const userHash = bcrypt.hashSync("tenis123", 10);
    const players: [string, string, string, string, string, string, string, number][] = [
      ["Raka Pratama", "raka@contoh.id", "Menengah", "Kanan", "Dua tangan", "Jakarta Selatan", "Main tiap Sabtu pagi. Suka reli panjang dari baseline, lagi belajar serve kick.", 18],
      ["Dinda Maharani", "dinda@contoh.id", "Mahir", "Kanan", "Satu tangan", "Depok", "Eks atlet junior. Main single maupun double.", 330],
      ["Bima Aditya", "bima@contoh.id", "Pemula", "Kiri", "Dua tangan", "Tangerang", "Baru mulai 6 bulan, masih semangat-semangatnya.", 210],
      ["Sekar Ayu", "sekar@contoh.id", "Menengah", "Kanan", "Dua tangan", "Jakarta Timur", "Spesialis double, net player.", 275],
      ["Yoga Santoso", "yoga@contoh.id", "Mahir", "Kiri", "Satu tangan", "Bekasi", "Serve and volley. Main malam sepulang kerja.", 45],
    ];
    players.forEach(([name, email, level, hand, backhand, city, bio, hue], i) =>
      stmts.push({ sql: insertUser, args: [name, email, `08130000000${i + 1}`, userHash, "user", level, hand, backhand, city, bio, hue] })
    );

    // Booking contoh: 3 minggu ke belakang + seminggu ke depan, deterministik. Database masih kosong, jadi id berurutan:
    // lapangan 1-2, admin 1, pemain 2-6. Bentrok dicek di memori supaya semuanya bisa dikirim dalam satu batch.
    let s = 20260918;
    const rand = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
    const today = todayWIB();
    const taken = new Set<string>();
    const upcomingPerUser = new Map<number, number>();
    for (let offset = -21; offset <= 6; offset++) {
      const date = addDays(today, offset);
      const n = 3 + Math.floor(rand() * 5);
      for (let k = 0; k < n; k++) {
        const courtId = 1 + Math.floor(rand() * 2);
        const start = [6, 7, 8, 9, 15, 16, 17, 18, 19, 20][Math.floor(rand() * 10)];
        const end = Math.min(22, start + 1 + Math.floor(rand() * 2));
        const hours = Array.from({ length: end - start }, (_, i) => `${courtId}:${date}:${start + i}`);
        if (hours.some((h) => taken.has(h))) continue;
        const userId = 2 + Math.floor(rand() * players.length);
        if (offset >= 0) {
          // Sisakan ruang di bawah batas booking aktif supaya akun demo tetap bisa mencoba booking.
          const upcoming = upcomingPerUser.get(userId) ?? 0;
          if (upcoming >= 2) continue;
          upcomingPerUser.set(userId, upcoming + 1);
        }
        hours.forEach((h) => taken.add(h));
        stmts.push({
          sql: "INSERT INTO bookings (code, user_id, court_id, date, start_hour, end_hour) VALUES (?,?,?,?,?,?)",
          args: [newBookingCode(), userId, courtId, date, start, end],
        });
      }
    }
  }
  await client.batch(stmts, "write");
}

const g = globalThis as unknown as { __sanapatiClient?: Promise<Client> };

async function open(): Promise<Client> {
  if (!REMOTE_URL && process.env.VERCEL) {
    throw new Error(
      "TURSO_DATABASE_URL belum diatur. Di Vercel sistem file read-only, jadi SQLite berbasis file tidak bisa dipakai. Lihat README bagian Deploy."
    );
  }
  let client: Client;
  if (REMOTE_URL) {
    // Klien "web" murni HTTP: tidak butuh binary native, cocok untuk serverless.
    const { createClient } = await import("@libsql/client/web");
    client = createClient({ url: REMOTE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
  } else {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const { createClient } = await import("@libsql/client");
    client = createClient({ url: `file:${path.join(DATA_DIR, "sanapati.db")}` });
    await client.execute("PRAGMA journal_mode = WAL");
    await client.execute("PRAGMA busy_timeout = 10000");
  }
  await client.execute("PRAGMA foreign_keys = ON").catch(() => {});
  await migrate(client);
  await seed(client);
  return client;
}

// Lazy + dibagi bersama: koneksi dibuka saat query pertama, bukan saat modul di-import
// (`next build` meng-import semua route di banyak worker sekaligus).
function ready(): Promise<Client> {
  if (!g.__sanapatiClient) {
    g.__sanapatiClient = open().catch((e) => {
      g.__sanapatiClient = undefined; // jangan menyimpan kegagalan: permintaan berikutnya boleh mencoba lagi
      throw e;
    });
  }
  return g.__sanapatiClient;
}

type Args = unknown[];
// Satu argumen berupa objek polos = parameter bernama (@nama); selain itu parameter posisi (?).
const toArgs = (args: Args): InArgs =>
  (args.length === 1 && args[0] !== null && typeof args[0] === "object" && !Array.isArray(args[0]) && !(args[0] instanceof Uint8Array)
    ? args[0]
    : args.map(normalize)) as InArgs;

// Driver menolak NaN/Infinity dengan melempar error. Itu bisa terjadi dari `Number(form.get(...))` pada
// permintaan yang dibuat-buat, dan hasilnya halaman 500. Diubah jadi null supaya query "WHERE id = ?"
// cukup mengembalikan "tidak ada baris" dan alur error yang rapi tetap berjalan.
function normalize(a: unknown) {
  if (a === undefined) return null;
  if (typeof a === "number" && !Number.isFinite(a)) return null;
  return a;
}

// Baris dijadikan objek polos: hasil query sering diteruskan ke client component, yang hanya menerima data serializable.
const plain = <T>(rs: ResultSet): T[] => rs.rows.map((row) => Object.fromEntries(rs.columns.map((c, i) => [c, row[i]])) as T);

type Executor = Pick<Client | Transaction, "execute">;

// Gangguan jaringan sesaat ke database cloud (timeout koneksi, socket putus) tidak boleh langsung jadi halaman error.
// Hanya query BACA yang diulang: mengulang query tulis berisiko dijalankan dua kali.
const isTransient = (e: unknown) => /fetch failed|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|socket hang up|Connect Timeout|network/i.test(
  `${(e as Error)?.message ?? e} ${((e as { cause?: Error })?.cause?.message ?? "")}`
);
// Gagal SAAT MENYAMBUNG = perintah belum pernah sampai ke server, jadi query tulis pun aman diulang.
// (Putus di tengah jalan — ECONNRESET dkk. — tidak termasuk: perintahnya mungkin sudah dijalankan.)
const neverConnected = (e: unknown) =>
  ["UND_ERR_CONNECT_TIMEOUT", "ECONNREFUSED", "EAI_AGAIN", "ENOTFOUND"].includes(String((e as { cause?: { code?: string } })?.cause?.code));

async function withRetry<T>(run: () => Promise<T>, shouldRetry: (e: unknown) => boolean): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (e) {
      if (attempt >= 2 || !shouldRetry(e)) throw e;
      await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
    }
  }
}
const readWithRetry = <T>(run: () => Promise<T>, retry: boolean) => withRetry(run, (e) => retry && (isTransient(e) || neverConnected(e)));
const writeWithRetry = <T>(run: () => Promise<T>, retry: boolean) => withRetry(run, (e) => retry && neverConnected(e));

// `retry` dimatikan di dalam transaksi: koneksi transaksi yang putus tidak bisa dilanjutkan, harus gagal seluruhnya.
const api = (exec: () => Promise<Executor>, retry = true) => ({
  async all<T>(sql: string, ...args: Args): Promise<T[]> {
    return plain<T>(await readWithRetry(async () => (await exec()).execute({ sql, args: toArgs(args) }), retry));
  },
  async get<T>(sql: string, ...args: Args): Promise<T | undefined> {
    return plain<T>(await readWithRetry(async () => (await exec()).execute({ sql, args: toArgs(args) }), retry))[0];
  },
  async run(sql: string, ...args: Args): Promise<{ lastInsertRowid: number; changes: number }> {
    const rs = await writeWithRetry(async () => (await exec()).execute({ sql, args: toArgs(args) }), retry);
    return { lastInsertRowid: Number(rs.lastInsertRowid ?? 0), changes: rs.rowsAffected };
  },
});
export type Tx = ReturnType<typeof api>;

export const db = {
  ...api(ready),
  /** Beberapa perintah tulis sekaligus, atomik (semua berhasil atau semua batal), dalam satu round-trip. */
  async batch(stmts: { sql: string; args?: Args }[]): Promise<void> {
    if (stmts.length === 0) return;
    const batch = stmts.map((s) => ({ sql: s.sql, args: toArgs(s.args ?? []) }));
    await writeWithRetry(async () => (await ready()).batch(batch, "write"), true);
  },
  /** Transaksi tulis interaktif: dipakai saat keputusan bergantung pada hasil baca di dalamnya (mis. cek bentrok lalu insert). */
  async tx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    const t = await (await ready()).transaction("write");
    try {
      const result = await fn(api(async () => t, false));
      await t.commit();
      return result;
    } catch (e) {
      await t.rollback().catch(() => {});
      throw e;
    } finally {
      t.close();
    }
  },
};
