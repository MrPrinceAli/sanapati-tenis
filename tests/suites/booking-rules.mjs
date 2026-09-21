/**
 * Aturan booking dan batas-batasnya.
 *
 * Semua diuji dari sisi SERVER: nilai di formulir diubah langsung lewat DOM sebelum dikirim,
 * meniru orang yang mengakali tampilan. Aturan yang hanya dijaga di tampilan akan ketahuan di sini.
 */
import { BASE, PLAYER, close, login, newPage, reporter } from "../helpers/browser.mjs";
import { count, one, q } from "../helpers/db.mjs";

const r = reporter("Aturan booking");
const errors = [];
const pg = await newPage(errors);
await login(pg, PLAYER);

const userId = (await one("SELECT id FROM users WHERE email = ?", PLAYER.email)).id;
const jam7 = 7 * 3600e3;
const hariWIB = (n) => new Date(Date.now() + jam7 + n * 86400e3).toISOString().slice(0, 10);
const aturan = Object.fromEntries((await q("SELECT key, value FROM settings")).map((x) => [x.key, x.value]));
const maxHari = Number(aturan.maxDaysAhead ?? 14);
const maxDurasi = Number(aturan.maxDuration ?? 3); // default aplikasi, lihat src/lib/time.ts
console.log(`  (aturan aktif: maks ${maxHari} hari ke depan, maks ${maxDurasi} jam, maks ${aturan.maxActiveBookings ?? 5} booking aktif)`);

/** Membuka papan, memilih satu slot, lalu memaksa nilai form sebelum mengirim. */
async function paksaBooking({ date, start, end, courtId = 1 }) {
  await pg.goto(`${BASE}/booking?tanggal=${hariWIB(1)}`);
  const slot = pg.locator("button[role=gridcell]").first();
  if (!(await slot.count())) return { pesan: "(tidak ada slot bebas untuk memulai)", dibuat: false };
  await slot.click();
  await pg.evaluate(
    ({ date, start, end, courtId }) => {
      document.querySelector('[name="date"]').value = date;
      document.querySelector('[name="start"]').value = String(start);
      document.querySelector('[name="end"]').value = String(end);
      document.querySelector('[name="courtId"]').value = String(courtId);
    },
    { date, start, end, courtId }
  );
  const sebelum = await count("SELECT COUNT(*) FROM bookings");
  await pg.click("text=Konfirmasi booking");
  await pg.waitForTimeout(1800);
  const pesan = await pg.locator("aside p[role=alert]").innerText().catch(() => "");
  const dibuat = (await count("SELECT COUNT(*) FROM bookings")) > sebelum;
  return { pesan, dibuat };
}

r.section("Batas waktu");
{
  const hasil = await paksaBooking({ date: hariWIB(maxHari + 5), start: 8, end: 9 });
  r.ok(!hasil.dibuat, `tanggal ${maxHari + 5} hari ke depan (melewati batas ${maxHari}) ditolak: "${hasil.pesan.slice(0, 50)}"`);
}
{
  const hasil = await paksaBooking({ date: hariWIB(-3), start: 8, end: 9 });
  r.ok(!hasil.dibuat, `tanggal di masa lalu ditolak: "${hasil.pesan.slice(0, 50)}"`);
  r.ok(/lewat|past/i.test(hasil.pesan), `alasannya tepat (bukan pesan "terlalu jauh ke depan"): "${hasil.pesan.slice(0, 50)}"`);
}
{
  const hasil = await paksaBooking({ date: hariWIB(2), start: 8, end: 8 + maxDurasi + 3 });
  r.ok(!hasil.dibuat, `durasi ${maxDurasi + 3} jam (melewati batas ${maxDurasi}) ditolak: "${hasil.pesan.slice(0, 50)}"`);
}

r.section("Nilai jam yang tidak masuk akal");
for (const [label, nilai] of [
  ["jam selesai lebih awal dari mulai", { start: 10, end: 8 }],
  ["jam mulai sama dengan selesai", { start: 10, end: 10 }],
  ["jam di luar jam operasional lapangan", { start: 2, end: 4 }],
  ["jam melewati tengah malam", { start: 22, end: 26 }],
  ["jam negatif", { start: -3, end: 1 }],
  ["jam bukan angka", { start: "abc", end: "xyz" }],
  ["jam pecahan", { start: 8.5, end: 9.5 }],
]) {
  const hasil = await paksaBooking({ date: hariWIB(2), ...nilai });
  r.ok(!hasil.dibuat, `${label} ditolak`);
}

r.section("Lapangan");
{
  const nonaktif = await one("SELECT id, name FROM courts WHERE active = 0 LIMIT 1");
  if (nonaktif) {
    const hasil = await paksaBooking({ date: hariWIB(2), start: 9, end: 10, courtId: nonaktif.id });
    r.ok(!hasil.dibuat, `lapangan nonaktif (${nonaktif.name}) tidak bisa dibooking`);
  } else {
    console.log("  (lewati: semua lapangan aktif)");
  }
  const hasil = await paksaBooking({ date: hariWIB(2), start: 9, end: 10, courtId: 99999 });
  r.ok(!hasil.dibuat, "lapangan yang tidak ada ditolak");
}

r.section("Slot ganda");
await pg.goto(`${BASE}/booking?tanggal=${hariWIB(3)}`);
const slotPertama = pg.locator("button[role=gridcell]").first();
await slotPertama.click();
const detail = await pg.evaluate(() => ({
  date: document.querySelector('[name="date"]').value,
  start: document.querySelector('[name="start"]').value,
  end: document.querySelector('[name="end"]').value,
  courtId: document.querySelector('[name="courtId"]').value,
}));
await pg.click("text=Konfirmasi booking");
await pg.waitForTimeout(1800);
const adaBooking = await count(
  "SELECT COUNT(*) FROM bookings WHERE date = ? AND court_id = ? AND start_hour = ? AND status = 'confirmed'",
  detail.date, Number(detail.courtId), Number(detail.start)
);
r.ok(adaBooking === 1, `slot pertama berhasil dibooking (${adaBooking} baris)`);

const ulang = await paksaBooking({ date: detail.date, start: Number(detail.start), end: Number(detail.end), courtId: Number(detail.courtId) });
r.ok(!ulang.dibuat, `slot yang sama dibooking lagi ditolak: "${ulang.pesan.slice(0, 50)}"`);

r.section("Dua orang merebut slot yang sama di detik yang sama");
{
  const tanggal = hariWIB(4);
  const a = await newPage(errors);
  const b = await newPage(errors);
  await login(a, PLAYER);
  await login(b, { email: "bima@contoh.id", password: "tenis123" });
  for (const p of [a, b]) {
    await p.goto(`${BASE}/booking?tanggal=${tanggal}`);
    await p.locator("button[role=gridcell]").first().click();
  }
  const target = await a.evaluate(() => ({
    date: document.querySelector('[name="date"]').value,
    start: document.querySelector('[name="start"]').value,
    courtId: document.querySelector('[name="courtId"]').value,
  }));
  // Kedua peramban diarahkan ke slot yang sama, lalu dikirim bersamaan.
  await b.evaluate((t) => {
    document.querySelector('[name="date"]').value = t.date;
    document.querySelector('[name="start"]').value = t.start;
    document.querySelector('[name="end"]').value = String(Number(t.start) + 1);
    document.querySelector('[name="courtId"]').value = t.courtId;
  }, target);
  await Promise.all([
    a.click("text=Konfirmasi booking").catch(() => {}),
    b.click("text=Konfirmasi booking").catch(() => {}),
  ]);
  await a.waitForTimeout(3000);
  const jumlah = await count(
    "SELECT COUNT(*) FROM bookings WHERE date = ? AND court_id = ? AND start_hour = ? AND status = 'confirmed'",
    target.date, Number(target.courtId), Number(target.start)
  );
  r.ok(jumlah === 1, `tepat satu booking tersimpan untuk slot rebutan (dapat ${jumlah})`);
}

r.section("Batas booking aktif");
{
  const batas = Number(aturan.maxActiveBookings ?? 5);
  const aktifSekarang = await count(
    "SELECT COUNT(*) FROM bookings WHERE user_id = ? AND status = 'confirmed' AND date >= ?",
    userId, hariWIB(0)
  );
  let ditolak = false;
  for (let i = 0; i < batas + 3 && !ditolak; i++) {
    await pg.goto(`${BASE}/booking?tanggal=${hariWIB(5 + i)}`);
    const slot = pg.locator("button[role=gridcell]").first();
    if (!(await slot.count())) continue;
    await slot.click();
    await pg.click("text=Konfirmasi booking");
    await pg.waitForTimeout(1500);
    const pesan = await pg.locator("aside p[role=alert]").innerText().catch(() => "");
    if (/maksimal|maximum|batas/i.test(pesan)) ditolak = true;
  }
  const akhir = await count(
    "SELECT COUNT(*) FROM bookings WHERE user_id = ? AND status = 'confirmed' AND date >= ?",
    userId, hariWIB(0)
  );
  r.ok(akhir <= batas, `booking aktif berhenti di batas ${batas} (mulai ${aktifSekarang}, berakhir ${akhir})`);
}

r.section("Zona waktu (WIB, UTC+7)");
{
  // Papan booking hari ini tidak boleh menawarkan jam yang sudah lewat menurut WIB.
  const sekarangWIB = new Date(Date.now() + jam7);
  const jamSekarang = sekarangWIB.getUTCHours();
  await pg.goto(`${BASE}/booking?tanggal=${hariWIB(0)}`);
  const jamTerbuka = await pg.evaluate(() =>
    [...document.querySelectorAll("[role=row]")]
      .map((baris) => {
        const judul = baris.querySelector("[role=rowheader]");
        const adaTombol = baris.querySelector("button[role=gridcell]");
        return judul && adaTombol ? parseInt(judul.textContent, 10) : null;
      })
      .filter((x) => x !== null)
  );
  const jamLewat = jamTerbuka.filter((j) => j < jamSekarang);
  r.ok(
    jamLewat.length === 0,
    jamLewat.length === 0
      ? `hari ini (${hariWIB(0)}, jam ${jamSekarang} WIB): tidak ada jam lampau yang masih bisa dibooking`
      : `jam yang sudah lewat masih terbuka: ${jamLewat.join(",")} (sekarang ${jamSekarang} WIB)`
  );
}

await close();
process.exit(r.finish(errors));
