// Menyalin isi database lokal (data/sanapati.db) ke Turso. Opsional — hanya kalau data lokal ingin dibawa ke produksi.
//
//   1. Buka situs produksi sekali dulu supaya tabel-tabelnya dibuat di Turso.
//   2. TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... node scripts/push-to-turso.mjs
//
// PERINGATAN: isi tabel di Turso DIGANTI dengan isi lokal. Foto yang diunggah di lokal tidak ikut (tersimpan sebagai file),
// jadi avatar lokal dikosongkan dan foto galeri hasil unggahan lokal dilewati.
import { createClient } from "@libsql/client";
import path from "node:path";

const { TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: authToken, DATA_DIR } = process.env;
if (!url) throw new Error("TURSO_DATABASE_URL belum diisi.");
if (!process.argv.includes("--yes")) {
  console.log("Ini akan MENGGANTI isi database Turso dengan data lokal. Jalankan lagi dengan --yes untuk melanjutkan.");
  process.exit(1);
}

const local = createClient({ url: `file:${path.join(DATA_DIR ? path.resolve(DATA_DIR) : path.join(process.cwd(), "data"), "sanapati.db")}` });
const remote = createClient({ url, authToken });

// Urutan mengikuti foreign key: induk dulu saat mengisi, anak dulu saat mengosongkan.
const TABLES = ["users", "courts", "gallery", "settings", "bookings", "mm_sessions", "mm_players", "mm_matches"];
const isLocalUpload = (v) => typeof v === "string" && (v.startsWith("/media/") || /^[a-f0-9]{24}\.(jpg|png|webp)$/.test(v));

const stmts = [...TABLES].reverse().map((t) => `DELETE FROM ${t}`);
for (const table of TABLES) {
  const { columns, rows } = await local.execute(`SELECT * FROM ${table}`);
  let copied = 0;
  for (const row of rows) {
    const values = columns.map((c, i) => (table === "users" && c === "avatar" && isLocalUpload(row[i]) ? "" : row[i]));
    if (table === "gallery" && isLocalUpload(row[columns.indexOf("src")])) continue;
    stmts.push({ sql: `INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`, args: values });
    copied++;
  }
  console.log(`${table.padEnd(12)} ${copied} baris`);
}
await remote.batch(stmts, "write"); // satu transaksi: kalau ada yang gagal, Turso tidak berubah sama sekali
console.log("Selesai. Password akun ikut tersalin (dalam bentuk hash), jadi login memakai password yang sama dengan di lokal.");
