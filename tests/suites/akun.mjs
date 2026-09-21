/**
 * Pendaftaran, masuk, sesi, ganti password, dan privasi profil.
 * Yang dikejar: sesi yang seharusnya mati tapi masih hidup, dan data pengguna yang bocor.
 */
import { ADMIN, BASE, close, login, newPage, reporter } from "../helpers/browser.mjs";
import { count, one, q } from "../helpers/db.mjs";

const r = reporter("Akun & autentikasi");
const errors = [];
const unik = Date.now() % 100000;

r.section("Pendaftaran");
const daftar = async (pg, { nama, email, telepon, password }) => {
  await pg.goto(`${BASE}/daftar`);
  await pg.fill("#name", nama);
  await pg.fill("#email", email);
  await pg.fill("#phone", telepon);
  await pg.fill("#password", password);
  await pg.click("main form button[type=submit]");
  await pg.waitForTimeout(1800);
  return pg.locator("main p[role=alert]").innerText().catch(() => "");
};

const baru = await newPage(errors);
const emailBaru = `uji${unik}@contoh.id`;
await daftar(baru, { nama: "Uji Sekali", email: emailBaru, telepon: "081200001111", password: "rahasia123" });
r.ok((await count("SELECT COUNT(*) FROM users WHERE email = ?", emailBaru)) === 1, "akun baru terbuat");

const kedua = await newPage(errors);
const pesanDobel = await daftar(kedua, { nama: "Peniru", email: emailBaru, telepon: "081200002222", password: "rahasia123" });
r.ok(
  (await count("SELECT COUNT(*) FROM users WHERE email = ?", emailBaru)) === 1,
  `email yang sudah dipakai ditolak: "${pesanDobel.slice(0, 45)}"`
);

const huruf = await newPage(errors);
await daftar(huruf, { nama: "Besar Kecil", email: emailBaru.toUpperCase(), telepon: "081200003333", password: "rahasia123" });
r.ok(
  (await count("SELECT COUNT(*) FROM users WHERE lower(email) = ?", emailBaru)) === 1,
  "email dengan huruf besar tidak bisa dipakai mendaftar ulang (email tidak case-sensitive)"
);

const lemah = await newPage(errors);
const sebelumLemah = await count("SELECT COUNT(*) FROM users");
await daftar(lemah, { nama: "Pendek", email: `pendek${unik}@contoh.id`, telepon: "081200004444", password: "123" });
r.ok((await count("SELECT COUNT(*) FROM users")) === sebelumLemah, "password terlalu pendek ditolak");

r.section("Pembatas percobaan masuk");
{
  const penyerang = await newPage(errors);
  // Email khusus untuk bagian ini: pembatas mengunci per alamat email selama 10 menit,
  // jadi memakai email yang dipakai uji lain akan menggagalkan uji itu karena sebab yang keliru.
  const emailGembok = `gembok${unik}@contoh.id`;
  let kena = false;
  for (let i = 0; i < 12 && !kena; i++) {
    await penyerang.goto(`${BASE}/masuk`);
    await penyerang.fill("#email", emailGembok);
    await penyerang.fill("#password", `salah${i}`);
    await penyerang.click("main form button[type=submit]");
    await penyerang.waitForTimeout(500);
    const pesan = await penyerang.locator("main p[role=alert]").innerText().catch(() => "");
    if (/terlalu banyak|too many/i.test(pesan)) kena = true;
  }
  r.ok(kena, "percobaan password beruntun akhirnya diblokir");
  // Catatan penting: pembatas ini disimpan di memori proses, jadi di Vercel (banyak instance,
  // sering restart) perlindungannya jauh lebih lemah daripada saat diuji lokal seperti ini.
}

r.section("Sesi mati saat akun dibekukan");
{
  // Pendaftaran langsung membuat sesi, jadi halaman ini sudah masuk sebagai pengguna baru.
  const korban = baru;
  await korban.goto(`${BASE}/akun`);
  r.ok((await korban.locator("#name").count()) === 1, "pengguna bisa membuka halaman akunnya");

  const admin = await newPage(errors);
  await login(admin, ADMIN);
  const id = (await one("SELECT id FROM users WHERE email = ?", emailBaru)).id;
  await admin.goto(`${BASE}/admin/pengguna/${id}`);
  // Pembekuan adalah checkbox di dalam formulir edit pengguna, bukan tombol tersendiri.
  const kotakBeku = admin.locator("input[name=suspended]").first();
  if (await kotakBeku.count()) {
    await kotakBeku.check();
    await admin.locator("form:has(input[name=suspended]) button[type=submit]").first().click();
    await admin.waitForTimeout(2000);
    const beku = (await one("SELECT suspended FROM users WHERE id = ?", id)).suspended;
    r.ok(Number(beku) === 1, "admin membekukan akun");
    await korban.goto(`${BASE}/akun`);
    r.ok(!korban.url().includes("/akun") || (await korban.locator("#name").count()) === 0, "sesi yang sudah berjalan langsung kehilangan akses");
  } else {
    r.ok(false, "kotak centang Bekukan tidak ditemukan di halaman admin pengguna");
  }
}

r.section("Ganti password memutus sesi lama");
{
  const email2 = `ganti${unik}@contoh.id`;
  const p = await newPage(errors);
  await daftar(p, { nama: "Ganti Sandi", email: email2, telepon: "081200005555", password: "awalnya123" });

  // Sesi kedua di perangkat lain, seolah-olah milik orang yang mencuri sesi.
  const lama = await newPage(errors);
  await login(lama, { email: email2, password: "awalnya123" });
  await lama.goto(`${BASE}/akun`);
  r.ok((await lama.locator("#name").count()) === 1, "sesi kedua aktif sebelum password diganti");

  await p.goto(`${BASE}/akun`);
  const formSandi = p.locator("form:has(#current)").first();
  if (await formSandi.count()) {
    await p.fill("#current", "awalnya123");
    await p.fill("#next", "barunya456");
    await formSandi.locator("button[type=submit]").click();
    await p.waitForTimeout(2000);
    const hashBaru = await one("SELECT password_changed_at FROM users WHERE email = ?", email2);
    r.ok(!!hashBaru?.password_changed_at, "waktu ganti password tercatat");
    await lama.goto(`${BASE}/akun`);
    const masihHidup = (await lama.locator("#name").count()) === 1;
    r.ok(!masihHidup, "sesi lama di perangkat lain ikut mati setelah password diganti");
  } else {
    r.ok(false, "formulir ganti password tidak ditemukan di /akun");
  }
}

r.section("Lupa password tidak membocorkan email terdaftar");
{
  const p = await newPage(errors);
  const minta = async (email) => {
    await p.goto(`${BASE}/lupa-password`);
    await p.fill("#email", email);
    await p.click("main form button[type=submit]");
    await p.waitForTimeout(1500);
    return p.locator("main p[role=status], main p[role=alert]").first().innerText().catch(() => "");
  };
  const ada = await minta("raka@contoh.id");
  const tidakAda = await minta(`entah${unik}@contoh.id`);
  r.ok(
    ada.trim() === tidakAda.trim(),
    ada.trim() === tidakAda.trim()
      ? "jawaban sama persis untuk email terdaftar dan tidak terdaftar"
      : `BOCOR — jawaban berbeda:\n        terdaftar: "${ada.slice(0, 60)}"\n        tidak ada: "${tidakAda.slice(0, 60)}"`
  );
  const token = await q("SELECT used_at, expires_at FROM password_resets ORDER BY id DESC LIMIT 1");
  r.ok(token.length > 0 && token[0].used_at === null, "token reset dibuat dan belum terpakai");
}

r.section("Privasi profil");
{
  const tersembunyi = await q("SELECT id, name FROM users WHERE is_public = 0 LIMIT 1");
  const tamu = await newPage(errors);
  if (tersembunyi.length) {
    const res = await tamu.goto(`${BASE}/pemain/${tersembunyi[0].id}`);
    const isi = await tamu.locator("body").innerText();
    r.ok(/Out!/.test(isi), `profil yang disetel privat tidak bisa dilihat orang lain (HTTP ${res.status()})`);
  } else {
    console.log("  (lewati: tidak ada profil privat di data uji)");
  }
  await tamu.goto(`${BASE}/pemain`);
  // Diperiksa di dalam <main> saja: footer memang menampilkan alamat kontak klub dengan sengaja,
  // jadi memeriksa seluruh body akan salah menuduhnya sebagai kebocoran.
  const isi = await tamu.locator("main").innerText();
  const emailBocor = isi.match(/[\w.-]+@[\w.-]+/g) ?? [];
  r.ok(emailBocor.length === 0, `daftar pemain tidak menampilkan email siapa pun${emailBocor.length ? ` (bocor: ${emailBocor.join(", ")})` : ""}`);
  const teleponBocor = isi.match(/08\d{8,}/g) ?? [];
  r.ok(teleponBocor.length === 0, `daftar pemain tidak menampilkan nomor telepon siapa pun${teleponBocor.length ? ` (bocor: ${teleponBocor.join(", ")})` : ""}`);

  // Profil perorangan juga tidak boleh membocorkan kontak.
  const contoh = await q("SELECT id FROM users WHERE is_public = 1 LIMIT 1");
  if (contoh.length) {
    await tamu.goto(`${BASE}/pemain/${contoh[0].id}`);
    const profil = await tamu.locator("main").innerText();
    r.ok(!/[\w.-]+@[\w.-]+/.test(profil) && !/08\d{8,}/.test(profil), "halaman profil pemain tidak menampilkan email atau nomor telepon");
  }

  const api = await tamu.request.get(`${BASE}/api/reminders`);
  const teks = await api.text();
  r.ok(
    api.status() === 401 || api.status() === 403 || !/@/.test(teks),
    `/api/reminders tanpa sesi tidak membocorkan data (HTTP ${api.status()})`
  );
}

await close();
process.exit(r.finish(errors));
