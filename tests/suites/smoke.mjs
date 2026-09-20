/**
 * Sapuan menyeluruh: tiap halaman dibuka sebagai tamu, pemain, dan admin, dalam dua bahasa.
 * Yang dicari bukan cuma HTTP 500, tapi juga peringatan React di console —
 * kesalahan key, hydration mismatch, dan DOM bersarang tidak sah biasanya muncul di situ.
 */
import { ADMIN, BASE, PLAYER, close, launch, reporter } from "../helpers/browser.mjs";

const HALAMAN = [
  "/", "/booking", "/jadwal", "/jadwal?bulan=2026-12", "/mabar", "/mabar/baru", "/galeri",
  "/pemain", "/pemain/2", "/masuk", "/daftar", "/lupa-password", "/booking-saya", "/akun",
  "/admin", "/admin/booking", "/admin/lapangan", "/admin/galeri", "/admin/pengguna",
  "/admin/pengguna/2", "/admin/mabar", "/admin/pengaturan",
];

/** URL yang memang harus 404 — diperiksa terpisah supaya 404 tidak terhitung sebagai kegagalan. */
const HALAMAN_404 = ["/halaman-yang-tidak-ada"];

const r = reporter("Sapuan semua halaman");
const masalah = [];
const browser = await launch();

async function sapu(peran, bahasa, akun) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  await ctx.addCookies([{ name: "sanapati_lang", value: bahasa, url: BASE }]);
  const pg = await ctx.newPage();
  const catat = (pesan) => masalah.push(`[${peran}/${bahasa}] ${pg.url().replace(BASE, "") || "/"} :: ${pesan.slice(0, 150)}`);
  pg.on("console", (m) => {
    const teks = m.text();
    // 404 yang disengaja tetap membuat browser menulis error di console — itu bukan masalah aplikasi.
    if (/Failed to load resource.*404/.test(teks)) return;
    if (m.type() === "error" || /Warning:|each child|key prop|validateDOMNesting|hydrat/i.test(teks)) catat(teks);
  });
  pg.on("pageerror", (e) => catat(`PAGEERROR ${e.message}`));

  if (akun) {
    await pg.goto(`${BASE}/masuk`);
    await pg.fill("#email", akun.email);
    await pg.fill("#password", akun.password);
    await pg.click("main form button[type=submit]");
    await pg.waitForLoadState("networkidle");
  }

  let sehat = 0;
  for (const halaman of HALAMAN) {
    const res = await pg.goto(BASE + halaman, { waitUntil: "networkidle" }).catch(() => null);
    await pg.waitForTimeout(150);
    if (res && res.status() >= 500) catat(`HTTP ${res.status()}`);
    if (res && res.status() < 400) sehat++;
  }
  for (const halaman of HALAMAN_404) {
    const res = await pg.goto(BASE + halaman, { waitUntil: "networkidle" }).catch(() => null);
    if (res?.status() !== 404) catat(`${halaman} seharusnya 404, dapat ${res?.status()}`);
  }
  await ctx.close();
  return sehat;
}

for (const [peran, akun] of [["tamu", null], ["pemain", PLAYER], ["admin", ADMIN]]) {
  for (const bahasa of ["id", "en"]) {
    const sehat = await sapu(peran, bahasa, akun);
    r.ok(sehat === HALAMAN.length, `${peran}/${bahasa}: ${sehat}/${HALAMAN.length} halaman terbuka tanpa error server`);
  }
}
r.ok(masalah.length === 0, masalah.length ? `peringatan console:\n      - ${[...new Set(masalah)].join("\n      - ")}` : "tidak ada error atau peringatan console di mana pun");

await close();
process.exit(r.finish());
