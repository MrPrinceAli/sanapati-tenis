/**
 * Galeri: unduhan foto, unggah banyak file oleh admin, dan kiriman foto dari pengunjung
 * yang wajib lewat antrean persetujuan.
 */
import { ADMIN, BASE, close, login, newPage, reporter } from "../helpers/browser.mjs";
import { count, one, q } from "../helpers/db.mjs";
import { makePng } from "../helpers/images.mjs";

const r = reporter("Galeri");
const errors = [];
const png = (name, rgb) => ({ name, mimeType: "image/png", buffer: makePng(10, 10, rgb) });
const MB = 1024 * 1024;
// Foto "berat": dipakai untuk menguji peringatan ukuran yang muncul sejak file dipilih.
const pngBerat = (name, bytes) => ({ name, mimeType: "image/png", buffer: makePng(10, 10, [90, 90, 90], bytes) });

const pengunjung = await newPage(errors);
const admin = await newPage(errors);
await login(admin, ADMIN);

// ---------------------------------------------------------------- unduhan
r.section("Unduh foto dari preview");
await pengunjung.goto(`${BASE}/galeri`);
const fotoPertama = await one("SELECT id, title FROM gallery WHERE status = 'approved' ORDER BY id DESC LIMIT 1");
await pengunjung.locator("main button.cursor-zoom-in").first().click();
await pengunjung.waitForSelector("dialog[open]");
const tautanUnduh = pengunjung.locator("dialog[open] a[download]");
r.ok(await tautanUnduh.count() === 1, "tombol unduh muncul di preview foto");

const unduhan = await pengunjung.request.get(`${BASE}/api/gallery/${fotoPertama.id}/unduh`);
const disposisi = unduhan.headers()["content-disposition"] ?? "";
r.ok(unduhan.status() === 200, `rute unduh menjawab 200 (${unduhan.status()})`);
r.ok(disposisi.startsWith("attachment;"), `dikirim sebagai unduhan, bukan dibuka di tab (${disposisi.slice(0, 40)})`);
r.ok(/filename="[a-z0-9-]+\.(jpg|png|webp|svg)"/.test(disposisi), `nama berkas rapi: ${disposisi.split("filename=")[1] ?? "-"}`);
r.ok((await unduhan.body()).length > 0, "isi berkas benar-benar terkirim");
await pengunjung.keyboard.press("Escape");

const adaTapiPending = await one("SELECT id FROM gallery WHERE status = 'pending' LIMIT 1");
if (adaTapiPending) {
  const tolak = await pengunjung.request.get(`${BASE}/api/gallery/${adaTapiPending.id}/unduh`);
  r.ok(tolak.status() === 404, "foto yang belum disetujui tidak bisa diunduh lewat tautan langsung");
}

// ------------------------------------------------- kiriman dari pengunjung
r.section("Pengunjung mengirim foto tanpa akun");
const sebelum = await count("SELECT COUNT(*) FROM gallery");
await pengunjung.goto(`${BASE}/galeri`);
r.ok(await pengunjung.locator("#c-file").count() === 1, "formulir kirim foto tampil untuk pengunjung yang tidak login");
r.ok(!(await pengunjung.locator("nav a[href='/booking-saya']").isVisible().catch(() => false)), "pengunjung memang belum login");

await pengunjung.setInputFiles("#c-file", png("sore-di-sawangan.png", [220, 90, 60]));
await pengunjung.fill("#c-uploader", "Budi Pengunjung");
await pengunjung.selectOption("#c-category", { index: 1 });
await pengunjung.click("form:has(#c-file) button[type=submit]");
await pengunjung.waitForSelector("p[role=status]", { timeout: 15000 });
const pesan = await pengunjung.locator("p[role=status]").innerText();
r.ok(/terima kasih|thank you/i.test(pesan), `pengunjung dapat konfirmasi: "${pesan.slice(0, 55)}…"`);

const baru = await one("SELECT * FROM gallery ORDER BY id DESC LIMIT 1");
r.ok(await count("SELECT COUNT(*) FROM gallery") === sebelum + 1, "foto tersimpan di database");
r.ok(baru.status === "pending", `status foto = pending, bukan langsung tayang (${baru.status})`);
r.ok(baru.uploader === "Budi Pengunjung", `nama pengirim tercatat (${baru.uploader})`);
r.ok(baru.title === "sore di sawangan", `judul diambil dari nama file (${baru.title})`);

// ------------------------------------------- peringatan ukuran sejak dipilih
// Penting karena batas badan request Vercel memutus unggahan kebesaran sebelum server action
// jalan: tanpa peringatan di sisi klien, pengirim hanya melihat layar diam.
r.section("Foto kebesaran ditolak saat dipilih, sebelum tombol kirim");
const sebelumBesar = await count("SELECT COUNT(*) FROM gallery");
await pengunjung.goto(`${BASE}/galeri`);
await pengunjung.setInputFiles("#c-file", pngBerat("kebesaran.png", Math.round(2.4 * MB)));
const peringatan = pengunjung.locator("form:has(#c-file) p[role=alert]");
await peringatan.waitFor({ timeout: 5000 });
const isiPeringatan = await peringatan.innerText();
r.ok(/melebihi batas|over the/i.test(isiPeringatan), `peringatan muncul tanpa klik kirim: "${isiPeringatan.slice(0, 60)}…"`);
r.ok(/2 MB/.test(isiPeringatan), `batas yang berlaku ikut disebut (${isiPeringatan.match(/[\d.,]+ MB/g)?.join(" vs ") ?? "-"})`);
r.ok(
  await pengunjung.locator("#c-file").evaluate((el) => el.files.length) === 0,
  "file kebesaran dikeluarkan dari pilihan, jadi formulir tidak bisa terkirim membawanya"
);
await pengunjung.click("form:has(#c-file) button[type=submit]");
r.ok(await count("SELECT COUNT(*) FROM gallery") === sebelumBesar, "tidak ada apa pun terkirim ke server");

await pengunjung.setInputFiles("#c-file", png("ukuran-wajar.png", [30, 140, 120]));
r.ok(
  await pengunjung.locator("form:has(#c-file) p[role=alert]").count() === 0,
  "peringatan hilang begitu foto berukuran wajar dipilih"
);

r.section("Foto yang menunggu TIDAK boleh terlihat publik");
await pengunjung.goto(`${BASE}/galeri`);
r.ok(!(await pengunjung.locator(`main :text("${baru.title}")`).count()), "tidak muncul di halaman galeri");
await pengunjung.goto(`${BASE}/`);
r.ok(!(await pengunjung.locator(`:text("${baru.title}")`).count()), "tidak muncul di beranda");

// --------------------------------------------------------- admin menyetujui
r.section("Admin memeriksa antrean");
await admin.goto(`${BASE}/admin/galeri`);
const lencana = await admin.locator("nav[aria-label] a[href='/admin/galeri'] span").first().innerText().catch(() => "");
r.ok(Number(lencana) >= 1, `tab Galeri menampilkan lencana jumlah antrean (${lencana || "tidak ada"})`);
r.ok(await admin.locator(`:text("${baru.title}")`).count() > 0, "foto kiriman tampil di antrean admin");
r.ok(await admin.locator(':text("Budi Pengunjung")').count() > 0, "nama pengirim ikut tampil untuk admin");

await admin.locator(`form:has(input[value="${baru.id}"]) button:has-text("Setujui")`).first().click();
await admin.waitForLoadState("networkidle");
r.ok((await one("SELECT status FROM gallery WHERE id = ?", baru.id)).status === "approved", "status berubah jadi approved");
await pengunjung.goto(`${BASE}/galeri`);
r.ok(await pengunjung.locator(`main :text("${baru.title}")`).count() > 0, "setelah disetujui, foto muncul di galeri publik");

// ------------------------------------------------- unggah banyak file (admin)
r.section("Admin mengunggah banyak foto sekaligus");
const sebelumMassal = await count("SELECT COUNT(*) FROM gallery");
await admin.goto(`${BASE}/admin/galeri`);
await admin.setInputFiles("#g-file", [
  png("turnamen-a.png", [40, 90, 200]),
  png("turnamen-b.png", [60, 160, 90]),
  png("turnamen-c.png", [200, 180, 50]),
]);
await admin.fill("#g-title", "Turnamen internal");
await admin.click("form:has(#g-file) button[type=submit]");
await admin.waitForSelector("p[role=status]", { timeout: 25000 });
r.ok(await count("SELECT COUNT(*) FROM gallery") === sebelumMassal + 3, "tiga foto masuk dari satu kali submit");
const judul = (await q("SELECT title FROM gallery ORDER BY id DESC LIMIT 3")).map((x) => x.title).sort();
r.ok(
  JSON.stringify(judul) === JSON.stringify(["Turnamen internal 1", "Turnamen internal 2", "Turnamen internal 3"]),
  `judul diberi nomor urut otomatis (${judul.join(", ")})`
);
r.ok(await count("SELECT COUNT(*) FROM gallery WHERE status = 'pending'") === 0, "unggahan admin langsung tayang, tidak ikut antre");

// Jumlahnya 4,8 MB — lewat batas badan satu request. Foto dikirim satu per satu justru supaya
// jumlah begini tidak pernah jadi soal; yang dibatasi tinggal ukuran per foto.
r.section("Foto dikirim satu per satu, jadi totalnya tidak dibatasi");
const sebelumBerat = await count("SELECT COUNT(*) FROM gallery");
await admin.goto(`${BASE}/admin/galeri`);
await admin.setInputFiles("#g-file", [
  pngBerat("berat-1.png", Math.round(1.6 * MB)),
  pngBerat("berat-2.png", Math.round(1.6 * MB)),
  pngBerat("berat-3.png", Math.round(1.6 * MB)),
]);
r.ok(
  await admin.locator("form:has(#g-file) p[role=alert]").count() === 0,
  "tidak ada yang dipotong: tiap foto masih di bawah batas per foto"
);
await admin.fill("#g-title", "Berat tiga");
await admin.click("form:has(#g-file) button[type=submit]");
await admin.waitForSelector("form:has(#g-file) p[role=status]", { timeout: 60000 });
const hasilBerat = await admin.locator("form:has(#g-file) p[role=status]").innerText();
r.ok(
  await count("SELECT COUNT(*) FROM gallery") === sebelumBerat + 3,
  `tiga foto 1,6 MB (total 4,8 MB) masuk semua dari satu kali klik: "${hasilBerat.slice(0, 50)}…"`
);
const judulBerat = (await q("SELECT title FROM gallery ORDER BY id DESC LIMIT 3")).map((x) => x.title).sort();
r.ok(
  JSON.stringify(judulBerat) === JSON.stringify(["Berat tiga 1", "Berat tiga 2", "Berat tiga 3"]),
  `nomor urut judul tetap benar walau tiap foto request terpisah (${judulBerat.join(", ")})`
);

// Satu foto di atas 4 MB tetap mustahil: dipecah bagaimana pun ia tidak muat dalam satu request.
await admin.setInputFiles("#g-file", [pngBerat("raksasa.png", Math.round(4.3 * MB))]);
const tolakSatuan = admin.locator("form:has(#g-file) p[role=alert]");
await tolakSatuan.waitFor({ timeout: 5000 });
r.ok(/melebihi batas|over the/i.test(await tolakSatuan.innerText()), "foto tunggal di atas 4 MB tetap ditolak sejak dipilih");
r.ok(await admin.locator("#g-file").evaluate((el) => el.files.length) === 0, "foto raksasa tidak ikut ke pilihan");

// ------------------------------------------------------------- saklar admin
r.section("Saklar 'izinkan pengunjung mengirim foto'");
await pengunjung.goto(`${BASE}/galeri`); // formulir dimuat SELAGI masih diizinkan
await admin.goto(`${BASE}/admin/pengaturan`);
await admin.uncheck("input[name=publicUploads]");
await admin.click("main form button[type=submit]");
await admin.waitForSelector("p[role=status]");

// Formulir yang sudah terbuka di layar pengunjung tetap dikirim: server harus tetap menolak.
await pengunjung.setInputFiles("#c-file", png("nekat.png", [10, 10, 10]));
await pengunjung.click("form:has(#c-file) button[type=submit]");
await pengunjung.waitForSelector("p[role=alert]", { timeout: 15000 });
const tolakan = await pengunjung.locator("p[role=alert]").innerText();
r.ok(/ditutup|closed/i.test(tolakan), `server menolak kiriman walau formulir masih terbuka: "${tolakan.slice(0, 45)}…"`);
r.ok(await count("SELECT COUNT(*) FROM gallery WHERE status = 'pending'") === 0, "tidak ada foto nyangkut di database");

await pengunjung.goto(`${BASE}/galeri`);
r.ok(await pengunjung.locator("#c-file").count() === 0, "formulir hilang dari halaman galeri saat saklar mati");

await admin.goto(`${BASE}/admin/pengaturan`);
await admin.check("input[name=publicUploads]");
await admin.click("main form button[type=submit]");
await admin.waitForSelector("p[role=status]");
await pengunjung.goto(`${BASE}/galeri`);
r.ok(await pengunjung.locator("#c-file").count() === 1, "formulir kembali muncul saat saklar dinyalakan lagi");

// --------------------------------------------------------- batas antrean
r.section("Batas panjang antrean menahan penyalahgunaan");
await q(
  `INSERT INTO gallery (title, category, src, status, uploader)
   SELECT 'banjir ' || value, 'Lapangan', '/gallery/balls.svg', 'pending', 'spam'
   FROM (WITH RECURSIVE c(value) AS (SELECT 1 UNION ALL SELECT value + 1 FROM c WHERE value < 30) SELECT value FROM c)`
);
r.ok(await count("SELECT COUNT(*) FROM gallery WHERE status = 'pending'") === 30, "antrean diisi sampai batas (30)");
await pengunjung.goto(`${BASE}/galeri`);
await pengunjung.setInputFiles("#c-file", png("ke-31.png", [1, 2, 3]));
await pengunjung.click("form:has(#c-file) button[type=submit]");
await pengunjung.waitForSelector("p[role=alert]", { timeout: 15000 });
const penuh = await pengunjung.locator("p[role=alert]").innerText();
r.ok(/penuh|full/i.test(penuh), `kiriman ke-31 ditolak: "${penuh.slice(0, 45)}…"`);
r.ok(await count("SELECT COUNT(*) FROM gallery WHERE status = 'pending'") === 30, "antrean tidak bertambah");
await q("DELETE FROM gallery WHERE uploader = 'spam'");

await close();
process.exit(r.finish(errors));
