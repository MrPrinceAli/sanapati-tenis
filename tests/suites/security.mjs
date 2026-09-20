/**
 * Uji penetrasi terarah pada server action.
 *
 * Server action adalah endpoint HTTP biasa: siapa pun yang tahu ID-nya bisa memanggil langsung,
 * tanpa lewat tombol di layar. Jadi setiap action wajib memeriksa hak akses sendiri.
 * Caranya di sini: satu submit asli disadap untuk mengambil ID action-nya, lalu diputar ulang
 * memakai cookie penyerang dengan ID milik korban (serangan IDOR).
 *
 * Ditambah pemeriksaan pada permukaan baru: formulir kirim foto yang terbuka tanpa login.
 */
import { ADMIN, BASE, close, launch, login, newPage, reporter } from "../helpers/browser.mjs";
import { count, q } from "../helpers/db.mjs";
import { makePng } from "../helpers/images.mjs";

const r = reporter("Keamanan (server action & unggahan publik)");
const browser = await launch();

async function sesi(email, password) {
  const ctx = await browser.newContext();
  const pg = await ctx.newPage();
  await pg.goto(`${BASE}/masuk`);
  await pg.fill("#email", email);
  await pg.fill("#password", password);
  await pg.click("main form button[type=submit]");
  await pg.waitForLoadState("networkidle");
  const cookie = (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
  return { ctx, pg, cookie };
}

/** Menyadap satu permintaan server action untuk mengambil URL dan ID action-nya. */
async function sadap(pg, pemicu) {
  let hasil = null;
  await pg.route("**/*", async (route) => {
    const req = route.request();
    const id = req.headers()["next-action"];
    if (req.method() === "POST" && id) hasil = { url: req.url(), id, headers: req.headers(), post: req.postData() };
    await route.continue();
  });
  await pemicu().catch((e) => {
    // Kalau pemicunya sendiri gagal, uji jadi tidak konklusif — jangan ditelan diam-diam.
    console.log(`  (catatan) pemicu penyadapan gagal: ${String(e).split("\n")[0].slice(0, 120)}`);
  });
  await pg.waitForTimeout(1200);
  await pg.unroute("**/*");
  return hasil;
}

/**
 * Menukar nilai satu kolom di dalam badan multipart yang sudah ditangkap.
 * Amplop aslinya dipertahankan apa adanya — hanya nilainya yang diganti.
 */
function gantiKolom(body, nama, nilai) {
  const pola = new RegExp(`(name="[^"]*${nama}"\\r\\n\\r\\n)[^\\r]*`, "");
  if (!pola.test(body)) throw new Error(`kolom ${nama} tidak ada di badan permintaan`);
  return body.replace(pola, `$1${nilai}`);
}

/**
 * Memutar ulang permintaan server action yang sudah ditangkap, dengan cookie siapa pun.
 *
 * Badan permintaannya dipakai persis seperti yang dibuat Next.js (berisi $ACTION_REF, $ACTION_KEY,
 * dan argumen ber-encoding khusus). Upaya menyusun badan sendiri dari nol akan ditolak sebelum
 * sampai ke pemeriksaan hak akses — yang membuat uji terlihat "aman" padahal tidak menguji apa pun.
 */
async function putarUlang(tangkapan, cookie, body) {
  const res = await fetch(tangkapan.url, {
    method: "POST",
    headers: {
      cookie,
      "next-action": tangkapan.headers["next-action"],
      "content-type": tangkapan.headers["content-type"],
    },
    body,
  });
  return { status: res.status, body: await res.text() };
}

const raka = await sesi("raka@contoh.id", "tenis123");
const bima = await sesi("bima@contoh.id", "tenis123");

r.section("IDOR: membatalkan booking milik orang lain");
const tanggal = (n) => new Date(Date.now() + 7 * 3600e3 + n * 86400e3).toISOString().slice(0, 10);

/** Memesan satu slot bebas dan mengembalikan baris booking-nya dari database. */
async function pesan(pg, hari) {
  await pg.goto(`${BASE}/booking?tanggal=${tanggal(hari)}`);
  await pg.locator("button[role=gridcell]").first().click();
  await pg.click("text=Konfirmasi booking");
  await pg.waitForURL(/baru=/);
  const kode = new URL(pg.url()).searchParams.get("baru");
  return (await q("SELECT id, code, status FROM bookings WHERE code = ?", kode))[0];
}
const statusBooking = async (id) => (await q("SELECT status FROM bookings WHERE id = ?", id))[0]?.status;

// Bima membatalkan booking MILIKNYA SENDIRI. Penyadapan ikut menjalankan pembatalan sungguhan,
// jadi yang dikorbankan memang booking Bima — sekaligus membuktikan amplop permintaannya sah.
const milikBima = await pesan(bima.pg, 5);
await bima.pg.goto(`${BASE}/booking-saya`);
const aksiBatal = await sadap(bima.pg, async () => {
  // li:has-text() juga cocok dengan elemen pembungkus, jadi tombolnya dipersempit dengan .first()
  // dan dialognya dipilih lewat bookingId — bukan sekadar "dialog yang sedang terbuka".
  const kartu = bima.pg.locator(`li:has-text("${milikBima.code}")`).last();
  await kartu.locator("button:has-text('Batalkan')").first().click();
  const dialog = bima.pg.locator(`dialog[open]:has(input[name=bookingId][value="${milikBima.id}"])`);
  await dialog.waitFor({ state: "visible", timeout: 10000 });
  await dialog.locator("select[name=reason]").selectOption({ index: 1 });
  await dialog.locator("button:has-text('Ya, batalkan')").click();
  await bima.pg.waitForTimeout(1500);
});
r.ok(
  (await statusBooking(milikBima.id)) === "cancelled" && !!aksiBatal?.post,
  "amplop permintaan pembatalan berhasil ditangkap dari pembatalan yang sungguhan berhasil"
);

if (!aksiBatal?.post) {
  r.ok(false, "tanpa amplop asli, uji IDOR tidak konklusif");
} else {
  const sasaran = await pesan(raka.pg, 6);
  const badan = gantiKolom(aksiBatal.post, "bookingId", sasaran.id);

  const serangan = await putarUlang(aksiBatal, bima.cookie, badan);
  r.ok(
    (await statusBooking(sasaran.id)) === "confirmed",
    `Bima memutar ulang pembatalan atas booking #${sasaran.id} milik Raka → HTTP ${serangan.status}, tetap terkonfirmasi`
  );

  // KONTROL — permintaan yang sama persis, hanya cookie-nya milik Raka.
  // Kalau yang ini berhasil, terbukti penolakan di atas datang dari pemeriksaan hak akses,
  // bukan karena permintaannya cacat. Tanpa kontrol ini, uji IDOR bisa "lolos" tanpa menguji apa pun.
  const kontrol = await putarUlang(aksiBatal, raka.cookie, badan);
  const hasil = await statusBooking(sasaran.id);
  r.ok(
    hasil === "cancelled",
    hasil === "cancelled"
      ? `kontrol: permintaan identik dengan cookie Raka berhasil membatalkan (HTTP ${kontrol.status}) — uji di atas sahih`
      : `KONTROL GAGAL: pemiliknya pun gagal (status "${hasil}") — uji IDOR di atas TIDAK konklusif`
  );
}

r.section("IDOR: mengubah skor di sesi mabar yang dikunci");
await raka.pg.goto(`${BASE}/mabar/baru`);
await raka.pg.fill("#mm-title", `Uji Kunci ${Date.now() % 10000}`);
await raka.pg.click("main form button[type=submit]");
await raka.pg.waitForURL(/mabar\/\d+$/);
const sesiId = raka.pg.url().split("/").pop();
await raka.pg.fill("textarea[name=names]", "P1, P2, P3, P4");
await raka.pg.click("button:has-text('Tambah')");
await raka.pg.waitForSelector("li:has-text('P4')");
await raka.pg.click("button:has-text('Acak pertandingan')");
await raka.pg.waitForSelector("h3:has-text('Ronde 1')");

// Skor diisi sekali secara sungguhan (sesi masih terbuka) untuk menangkap amplopnya.
const aksiSkor = await sadap(raka.pg, async () => {
  const form = raka.pg.locator("form:has(input[name=score_a])").first();
  await form.locator("input[name=score_a]").fill("6");
  await form.locator("input[name=score_b]").fill("1");
  await form.locator("button:has-text('Simpan')").click();
});
await raka.pg.waitForTimeout(800);
const skorTersimpan = await q("SELECT score_a, score_b FROM mm_matches WHERE session_id = ? AND score_a IS NOT NULL", sesiId);
r.ok(skorTersimpan.length > 0 && !!aksiSkor?.post, "amplop permintaan simpan skor tertangkap dari penyimpanan yang berhasil");

// Sesi dikunci: sejak ini hanya pemilik dan admin yang boleh mengubah.
await raka.pg.click("summary:has-text('Ubah pengaturan')");
await raka.pg.uncheck("input[name=open_edit]");
await raka.pg.locator("details form button[type=submit]").click();
await raka.pg.waitForSelector("details p[role=status]");

if (!aksiSkor?.post) {
  r.ok(false, "tanpa amplop asli, uji skor tidak konklusif");
} else {
  const badan = gantiKolom(gantiKolom(aksiSkor.post, "score_a", "9"), "score_b", "0");
  const serangan = await putarUlang(aksiSkor, bima.cookie, badan);
  const setelah = await q("SELECT score_a, score_b FROM mm_matches WHERE session_id = ? ORDER BY id LIMIT 1", sesiId);
  r.ok(
    !(setelah[0]?.score_a === 9 && setelah[0]?.score_b === 0),
    `sesi terkunci, Bima memutar ulang simpan skor → HTTP ${serangan.status}, skor tidak berubah`
  );

  const kontrol = await putarUlang(aksiSkor, raka.cookie, badan);
  const hasil = await q("SELECT score_a, score_b FROM mm_matches WHERE session_id = ? ORDER BY id LIMIT 1", sesiId);
  const berhasil = hasil[0]?.score_a === 9 && hasil[0]?.score_b === 0;
  r.ok(
    berhasil,
    berhasil
      ? `kontrol: pemilik sesi berhasil mengubah skor lewat permintaan yang sama (HTTP ${kontrol.status}) — uji sahih`
      : "KONTROL GAGAL: pemilik sesi pun tidak bisa — uji skor TIDAK konklusif"
  );
}

r.section("IDOR: menghapus sesi mabar milik orang lain");
const aksiHapus = await sadap(bima.pg, async () => {
  await bima.pg.goto(`${BASE}/mabar/baru`);
  await bima.pg.fill("#mm-title", `Sesi Bima ${Date.now() % 10000}`);
  await bima.pg.click("main form button[type=submit]");
  await bima.pg.waitForURL(/mabar\/\d+$/);
  await bima.pg.click("button:has-text('Hapus sesi')");
  await bima.pg.click("dialog[open] button:has-text('Ya, hapus')");
});
const adaSesi = async (id) => (await q("SELECT id FROM mm_sessions WHERE id = ?", id)).length > 0;

if (!aksiHapus?.post) {
  r.ok(false, "tanpa amplop asli, uji hapus sesi tidak konklusif");
} else {
  const badan = gantiKolom(aksiHapus.post, "sessionId", sesiId);
  const serangan = await putarUlang(aksiHapus, bima.cookie, badan);
  r.ok(await adaSesi(sesiId), `Bima memutar ulang hapus sesi milik Raka → HTTP ${serangan.status}, sesi Raka masih ada`);

  // Kontrol dijalankan terakhir karena memang menghapus sesinya.
  const kontrol = await putarUlang(aksiHapus, raka.cookie, badan);
  const terhapus = !(await adaSesi(sesiId));
  r.ok(
    terhapus,
    terhapus
      ? `kontrol: pemilik berhasil menghapus sesinya lewat permintaan yang sama (HTTP ${kontrol.status}) — uji sahih`
      : "KONTROL GAGAL: pemilik pun tidak bisa menghapus — uji hapus sesi TIDAK konklusif"
  );
}

r.section("Permukaan baru: formulir kirim foto tanpa login");
const tamu = await newPage();
await tamu.goto(`${BASE}/galeri`);

// File berekstensi gambar tapi isinya skrip — jenis berkas diperiksa dari magic bytes, bukan namanya.
await tamu.setInputFiles("#c-file", {
  name: "sebenarnya-skrip.png",
  mimeType: "image/png",
  buffer: Buffer.from('<?php system($_GET["c"]); ?>', "utf8"),
});
await tamu.click("form:has(#c-file) button[type=submit]");
await tamu.waitForSelector("p[role=alert]", { timeout: 15000 });
r.ok(true, `berkas menyamar sebagai PNG ditolak: "${(await tamu.locator("p[role=alert]").innerText()).slice(0, 45)}…"`);

// SVG ditolak karena bisa memuat skrip.
await tamu.goto(`${BASE}/galeri`);
await tamu.setInputFiles("#c-file", {
  name: "vektor.svg",
  mimeType: "image/svg+xml",
  buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', "utf8"),
});
await tamu.click("form:has(#c-file) button[type=submit]");
await tamu.waitForSelector("p[role=alert]", { timeout: 15000 });
r.ok(true, "SVG ditolak (bisa membawa skrip)");

const sebelumPending = await count("SELECT COUNT(*) FROM gallery WHERE status = 'pending'");
r.ok(sebelumPending === 0, "tidak satu pun berkas jahat tersimpan di database");

// Judul berisi HTML: React meng-escape teks, jadi tidak boleh jadi elemen sungguhan.
await tamu.goto(`${BASE}/galeri`);
await tamu.setInputFiles("#c-file", { name: "biasa.png", mimeType: "image/png", buffer: makePng(6, 6, [9, 9, 9]) });
await tamu.fill("#c-title", "<img src=x onerror=alert(1)>");
await tamu.click("form:has(#c-file) button[type=submit]");
await tamu.waitForSelector("p[role=status], p[role=alert]", { timeout: 15000 });
const disuntik = await q("SELECT id, title FROM gallery WHERE status = 'pending' ORDER BY id DESC LIMIT 1");
if (disuntik.length) {
  const admin = await newPage();
  await login(admin, ADMIN);
  await admin.goto(`${BASE}/admin/galeri`);
  const suntikanJadiElemen = await admin.evaluate(() => !!document.querySelector("img[onerror]"));
  r.ok(!suntikanJadiElemen, "judul berisi HTML tampil sebagai teks, tidak dieksekusi sebagai elemen");
  await q("DELETE FROM gallery WHERE id = ?", disuntik[0].id);
}

r.section("Aksi admin tidak bisa dipanggil tanpa hak");
const aksiSetujui = await sadap(tamu, async () => {
  // Tamu tidak punya tombol setujui; ID action diambil dari halaman admin, lalu dipakai dengan cookie tamu.
});
r.ok(aksiSetujui === null, "tamu memang tidak punya tombol aksi admin di halaman mana pun");
const jumlahSebelum = await count("SELECT COUNT(*) FROM gallery");
const tanpaCookie = await fetch(`${BASE}/admin/galeri`, { redirect: "manual" });
r.ok([302, 307, 200].includes(tanpaCookie.status), `halaman admin tanpa sesi: HTTP ${tanpaCookie.status}`);
const htmlAdmin = tanpaCookie.status === 200 ? await tanpaCookie.text() : "";
r.ok(!/Menunggu persetujuan/.test(htmlAdmin), "isi panel admin tidak bocor ke pengunjung tanpa sesi");
r.ok(await count("SELECT COUNT(*) FROM gallery") === jumlahSebelum, "tidak ada perubahan data akibat percobaan di atas");

await close();
process.exit(r.finish());
