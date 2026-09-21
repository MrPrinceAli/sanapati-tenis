/**
 * Menjalankan seluruh rangkaian tes dari nol.
 *
 * Tiap jalankan memakai database yang baru disemai. Ini bukan kerapian belaka: tes membuat
 * booking, dan pemain punya batas booking aktif — kalau databasenya dipakai berulang, tes akan
 * mulai gagal karena batas itu, bukan karena aplikasinya rusak.
 *
 * Pemakaian:
 *   node tests/run.mjs                 # build, lalu jalankan semua suite
 *   node tests/run.mjs --lewati-build  # pakai build yang sudah ada
 *   node tests/run.mjs galeri keamanan # jalankan suite tertentu saja
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const akar = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = process.env.PORT ?? "3217";
const BASE_URL = `http://localhost:${PORT}`;
const DATA_DIR = process.env.TEST_DATA_DIR ?? "testdata";
const DIST = process.env.NEXT_DIST_DIR ?? ".next-test";
const ADMIN_PASSWORD = "admin123";

const SUITE = [
  ["sapuan", "smoke.mjs"],
  ["error", "errors.mjs"],
  ["galeri", "gallery.mjs"],
  ["aturan", "booking-rules.mjs"],
  ["akun", "akun.mjs"],
  ["undian", "matchmaking.mjs"],
  ["rutin", "recurring.mjs"],
  ["keamanan", "security.mjs"],
];

const argv = process.argv.slice(2);
const lewatiBuild = argv.includes("--lewati-build");
const diminta = argv.filter((a) => !a.startsWith("--"));
const dijalankan = diminta.length ? SUITE.filter(([nama]) => diminta.includes(nama)) : SUITE;
if (!dijalankan.length) {
  console.error(`Suite tidak dikenal. Pilihan: ${SUITE.map(([n]) => n).join(", ")}`);
  process.exit(2);
}

const jalankan = (perintah, args, env, opsi = {}) =>
  new Promise((selesai) => {
    const anak = spawn(perintah, args, { cwd: akar, env: { ...process.env, ...env }, stdio: opsi.diam ? "ignore" : "inherit" });
    anak.on("exit", (kode) => selesai(kode ?? 1));
  });

if (!lewatiBuild) {
  console.log("→ membangun aplikasi…");
  // Build memakai DATA_DIR terpisah: proses build ikut menyentuh database dan menyemai admin
  // dengan password acak. Kalau dibiarkan menimpa database uji, tes tidak bisa login sebagai admin.
  const kode = await jalankan("npx", ["next", "build"], { NEXT_DIST_DIR: DIST, DATA_DIR: ".build-scratch" }, { diam: true });
  fs.rmSync(path.join(akar, ".build-scratch"), { recursive: true, force: true });
  if (kode !== 0) {
    console.error("build gagal");
    process.exit(kode);
  }
}

console.log("→ menyiapkan database uji yang bersih…");
fs.rmSync(path.join(akar, DATA_DIR), { recursive: true, force: true });
fs.mkdirSync(path.join(akar, DATA_DIR), { recursive: true });

console.log(`→ menjalankan server di ${BASE_URL}…`);
const server = spawn("npx", ["next", "start", "-p", PORT], {
  cwd: akar,
  env: { ...process.env, NEXT_DIST_DIR: DIST, DATA_DIR, SEED_DEMO: "1", ADMIN_PASSWORD },
  stdio: "ignore",
});
const matikanServer = () => {
  if (!server.killed) server.kill("SIGTERM");
};
process.on("exit", matikanServer);
process.on("SIGINT", () => {
  matikanServer();
  process.exit(130);
});

let siap = false;
for (let i = 0; i < 90 && !siap; i++) {
  siap = await fetch(BASE_URL).then((r) => r.ok).catch(() => false);
  if (!siap) await new Promise((s) => setTimeout(s, 1000));
}
if (!siap) {
  console.error("server tidak kunjung siap");
  matikanServer();
  process.exit(1);
}

const env = {
  BASE_URL,
  ADMIN_PASSWORD,
  TEST_DB_URL: `file:${path.join(DATA_DIR, "sanapati.db")}`,
};
const gagal = [];
for (const [nama, berkas] of dijalankan) {
  const kode = await jalankan("node", [path.join("tests", "suites", berkas)], env);
  if (kode !== 0) gagal.push(nama);
}

matikanServer();
console.log("\n══════════════════════════════════");
if (gagal.length) {
  console.log(`GAGAL pada suite: ${gagal.join(", ")}`);
  console.log("══════════════════════════════════");
  process.exit(1);
}
console.log(`Semua suite lolos (${dijalankan.length}/${dijalankan.length})`);
console.log("══════════════════════════════════");
