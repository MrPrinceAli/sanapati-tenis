/**
 * Jadwal rutin mingguan klub (mis. Selasa & Jumat 16.00–22.00 di Sawangan).
 * Aturannya tidak disimpan sebagai booking, melainkan dihitung saat papan digambar —
 * jadi yang diuji: papan booking, kalender, penolakan server, dan hak istimewa admin.
 */
import { ADMIN, BASE, PLAYER, close, launch, login, newPage, reporter } from "../helpers/browser.mjs";

const r = reporter("Jadwal rutin klub");
const errors = [];
const admin = await newPage(errors);
const pemain = await newPage(errors);
await login(admin, ADMIN);
await login(pemain, PLAYER);

r.section("Admin memasang aturan");
await admin.goto(`${BASE}/admin/lapangan`);
await admin.selectOption("#rec-court", { label: "Sawangan" });
await admin.selectOption("#rec-start", "16");
await admin.selectOption("#rec-end", "22");
await admin.fill("#rec-note", "Jadwal Rutin Sanapati Tenis Club");
for (const hari of ["Selasa", "Jumat"]) {
  await admin.locator("label", { hasText: new RegExp(`^${hari}$`) }).click();
}
const bagian = "section:has-text('Jadwal rutin mingguan')";
await admin.locator(`${bagian} button[type=submit]`).click();
await admin.waitForSelector(`${bagian} p[role=status], ${bagian} p[role=alert]`);
const daftar = await admin.locator(`${bagian} li`).allInnerTexts();
r.ok(
  daftar.length === 2 && daftar.join(" ").includes("Selasa") && daftar.join(" ").includes("Jumat"),
  `dua aturan tercatat: ${daftar.map((x) => x.split("\n")[0]).join(" | ")}`
);

// Tanggal Selasa/Jumat/Rabu berikutnya dalam jendela booking, dihitung menurut waktu WIB.
const wib = (d) => new Date(d.getTime() + 7 * 3600e3).toISOString().slice(0, 10);
const berikutnya = (hariKe) => {
  for (let i = 1; i <= 14; i++) {
    const iso = wib(new Date(Date.now() + i * 86400e3));
    if (((new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7) + 1 === hariKe) return iso;
  }
  return null;
};
const selasa = berikutnya(2);
const jumat = berikutnya(5);
const rabu = berikutnya(3);

r.section("Papan booking menutup jam klub");
for (const [label, tanggal] of [["Selasa", selasa], ["Jumat", jumat]]) {
  await pemain.goto(`${BASE}/booking?tanggal=${tanggal}`);
  const papan = await pemain.evaluate(() => {
    const hasil = { tertutup: [], ragunanTerbuka: [] };
    for (const baris of document.querySelectorAll("[role=row]")) {
      const judul = baris.querySelector("[role=rowheader]");
      if (!judul) continue;
      const jam = parseInt(judul.textContent, 10);
      const sel = [...baris.querySelectorAll("[role=gridcell]")];
      if (sel[0] && sel[0].tagName !== "BUTTON" && /Jadwal Rutin|Klub|Club/.test(sel[0].textContent)) hasil.tertutup.push(jam);
      if (sel[1] && sel[1].tagName === "BUTTON") hasil.ragunanTerbuka.push(jam);
    }
    return hasil;
  });
  r.ok(
    JSON.stringify(papan.tertutup) === JSON.stringify([16, 17, 18, 19, 20, 21]),
    `${label}: Sawangan jam 16–21 tertutup (${papan.tertutup.join(",")})`
  );
  r.ok(papan.ragunanTerbuka.some((h) => h >= 16 && h < 22), `${label}: Ragunan di jam yang sama tetap bisa dibooking`);
}
await pemain.goto(`${BASE}/booking?tanggal=${rabu}`);
r.ok(
  (await pemain.locator("[role=gridcell]").filter({ hasText: /Jadwal Rutin/ }).count()) === 0,
  "hari di luar aturan (Rabu) tidak terpengaruh"
);

r.section("Server menolak walau formulir dipaksa");
await pemain.goto(`${BASE}/booking?tanggal=${rabu}`);
await pemain.locator("button[role=gridcell]").first().click();
// Nilai form diubah langsung di browser, meniru orang yang mengakali tampilan.
await pemain.evaluate((d) => {
  document.querySelector('[name="date"]').value = d;
  document.querySelector('[name="start"]').value = "17";
  document.querySelector('[name="end"]').value = "18";
  document.querySelector('[name="courtId"]').value = "1";
}, selasa);
await pemain.click("text=Konfirmasi booking");
await pemain.waitForTimeout(2000);
const tolakan = await pemain.locator("aside p[role=alert]").innerText().catch(() => "");
r.ok(/jadwal rutin klub/i.test(tolakan), `booking paksa ditolak server: "${tolakan.slice(0, 55)}…"`);

r.section("Kalender & bahasa Inggris");
await pemain.goto(`${BASE}/jadwal?tanggal=${selasa}&bulan=${selasa.slice(0, 7)}`);
const kalender = await pemain.locator("section").nth(1).innerText();
r.ok(
  /Jadwal Rutin Sanapati Tenis Club/.test(kalender) && /16[:.]00 – 22[:.]00/.test(kalender),
  "kalender menampilkan label lengkap beserta jamnya"
);
const en = await (await launch()).newContext();
await en.addCookies([{ name: "sanapati_lang", value: "en", url: BASE }]);
const halamanEn = await en.newPage();
await halamanEn.goto(`${BASE}/booking?tanggal=${selasa}`);
r.ok((await halamanEn.locator("[role=gridcell]:has-text('Club')").count()) > 0, "versi Inggris tetap menampilkan labelnya");

r.section("Admin tetap bisa menimpa jam klub");
await admin.goto(`${BASE}/admin/booking`);
await admin.click("summary:has-text('Buat booking')");
await admin.selectOption("#new-user", { index: 1 });
await admin.fill("#date-new", selasa);
await admin.selectOption("#court-new", { label: "Sawangan" });
await admin.selectOption("#start-new", "17");
await admin.selectOption("#end-new", "18");
await admin.locator("details form button[type=submit]").click();
await admin.waitForSelector("details p[role=status], details p[role=alert]");
const pesanAdmin = await admin.locator("details p[role=status], details p[role=alert]").first().innerText();
r.ok(/dibuat|created/i.test(pesanAdmin), `admin boleh menembus jam klub: "${pesanAdmin.slice(0, 45)}…"`);

await close();
process.exit(r.finish(errors));
