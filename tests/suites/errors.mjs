/**
 * Halaman error dan tampilan saat memuat.
 *
 * Kegagalan diuji dengan cara yang benar-benar terjadi di produksi: tabel yang dibutuhkan
 * halaman mendadak tidak bisa dibaca (gangguan database). Tabelnya dinamai ulang sebentar,
 * lalu dikembalikan — jadi uji ini memeriksa jalur error yang asli, bukan halaman tiruan.
 */
import { ADMIN, BASE, close, login, newPage, reporter } from "../helpers/browser.mjs";
import { q } from "../helpers/db.mjs";

const r = reporter("Halaman error & memuat");
const errors = [];
// Halaman error memang menulis error ke console — itu perilaku yang diinginkan, bukan kegagalan.
const page = await newPage();

/** Menyembunyikan satu tabel selama fn berjalan, apa pun hasilnya tabel dikembalikan. */
async function tanpaTabel(nama, fn) {
  await q(`ALTER TABLE ${nama} RENAME TO ${nama}_disembunyikan`);
  try {
    return await fn();
  } finally {
    await q(`ALTER TABLE ${nama}_disembunyikan RENAME TO ${nama}`);
  }
}

r.section("Halaman publik gagal → batas error situs");
await tanpaTabel("gallery", async () => {
  await page.goto(`${BASE}/galeri`, { waitUntil: "domcontentloaded" });
  const body = await page.locator("body").innerText();
  // Catatan: status HTTP-nya tetap 200. Next.js mengalirkan (stream) halaman, jadi header sudah
  // terkirim sebelum query gagal, dan batas error mengambil alih di sisi browser. Yang menentukan
  // di sini adalah apa yang dilihat pengunjung, bukan angka statusnya.
  r.ok(/Net!/.test(body), "halaman error bermerek Sanapati tampil, bukan layar error mentah Next.js");
  r.ok(/net|bermasalah/i.test(body), "pesannya berbahasa Indonesia");
  r.ok(await page.locator("button:has-text('Coba lagi')").count() === 1, "ada tombol 'Coba lagi'");
  r.ok(await page.locator("header nav").count() > 0, "navigasi situs tetap ada — pengunjung tidak terjebak");
  r.ok(await page.locator("footer").count() > 0, "footer tetap ada");
  r.ok(await page.locator("footer :text('Sanapati Tenis Club')").count() > 0, "footer masih menampilkan identitas klub");
});
await page.goto(`${BASE}/galeri`);
r.ok(await page.locator("#c-file, main button.cursor-zoom-in").count() > 0, "setelah database pulih, halaman kembali normal");

r.section("Halaman admin gagal → batas error admin");
const admin = await newPage();
await login(admin, ADMIN);
await tanpaTabel("mm_sessions", async () => {
  await admin.goto(`${BASE}/admin/mabar`, { waitUntil: "domcontentloaded" });
  const body = await admin.locator("body").innerText();
  r.ok(/bermasalah|net/i.test(body), "panel admin menampilkan pesan error yang rapi");
  r.ok(await admin.locator("button:has-text('Coba lagi')").count() === 1, "ada tombol 'Coba lagi' di admin");
  r.ok(await admin.locator("nav[aria-label] a[href='/admin/booking']").count() > 0, "menu admin tetap hidup — tab lain masih bisa diklik");
});
await admin.goto(`${BASE}/admin/mabar`);
r.ok(await admin.locator("h1").count() > 0, "halaman admin kembali normal setelah database pulih");

r.section("Halaman 404");
await page.goto(`${BASE}/halaman-yang-tidak-ada`);
r.ok(await page.locator(":text('Out!')").count() > 0, "URL asing memberi halaman 404 bermerek");
r.ok(await page.locator("header nav").count() > 0, "404 membawa navigasi (dulu jadi jalan buntu tanpa menu)");
r.ok(await page.locator("footer").count() > 0, "404 membawa footer");
r.ok(await page.locator("a[href='/']").count() > 0, "ada jalan kembali ke beranda");

await page.goto(`${BASE}/pemain/99999999`);
r.ok(await page.locator(":text('Out!')").count() > 0, "profil pemain yang tidak ada memberi halaman 404 yang sama");
r.ok(await page.locator("header nav").count() > 0, "404 dari dalam situs juga tetap berkerangka");

r.section("Tampilan saat memuat");
await page.goto(`${BASE}/`);
// Tahan balasan navigasi supaya kerangka abu-abu sempat terlihat.
await page.route("**/pemain**", async (route) => {
  await new Promise((s) => setTimeout(s, 2500));
  await route.continue();
});
await page.click("footer a[href='/pemain']").catch(() => page.click("a[href='/pemain']"));
const skeleton = await page
  .waitForSelector("[role=status][aria-busy=true]", { timeout: 4000 })
  .then(() => true)
  .catch(() => false);
r.ok(skeleton, "kerangka 'memuat' tampil selagi halaman disiapkan, bukan layar kosong");
await page.unroute("**/pemain**");

await close();
process.exit(r.finish(errors));
