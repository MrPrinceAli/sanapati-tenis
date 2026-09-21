/**
 * Mesin undian mabar. Ini satu-satunya suite tanpa browser — modulnya fungsi murni,
 * jadi bisa dijalankan langsung dan disapu banyak kombinasi sekaligus.
 */
import { spawnSync } from "node:child_process";
import { reporter } from "../helpers/browser.mjs";

const r = reporter("Mesin undian mabar");
const skrip = `
import { planRounds } from "./src/lib/matchmaking.ts";
const jalankan = (pria, wanita, rule, format = "doubles", courts = 1, rounds = 6) => {
  const players = [];
  let id = 1;
  for (let i = 0; i < wanita; i++) players.push({ id: id++, gender: "F" });
  for (let i = 0; i < pria; i++) players.push({ id: id++, gender: "M" });
  const plan = planRounds(players, [], { format, genderRule: rule, courts, maxRounds: rounds, targetPlays: 0 }, 1);
  const n = new Map(players.map((p) => [p.id, 0]));
  for (const ronde of plan) for (const m of ronde.matches) for (const pid of [...m.a, ...m.b]) n.set(pid, n.get(pid) + 1);
  const jumlah = players.map((p) => n.get(p.id));
  return { ronde: plan.length, jumlah, nol: jumlah.filter((x) => x === 0).length };
};
const hasil = {
  adil: [],
  sesama_4_3: jalankan(4, 3, "same"),
  campuran_8_2: jalankan(8, 2, "mixed"),
  kosong: jalankan(0, 0, "any"),
  satu: jalankan(1, 0, "any"),
  tiga_duo: jalankan(3, 0, "any"),
};
for (let n = 4; n <= 13; n++) for (const courts of [1, 2]) {
  const h = jalankan(n, 0, "any", "doubles", courts);
  hasil.adil.push({ n, courts, selisih: Math.max(...h.jumlah) - Math.min(...h.jumlah) });
}
console.log(JSON.stringify(hasil));
`;
const out = spawnSync("npx", ["tsx", "--eval", skrip], { cwd: process.cwd(), encoding: "utf8" });
if (out.status !== 0) {
  r.ok(false, `gagal menjalankan mesin undian: ${(out.stderr || "").slice(0, 200)}`);
  process.exit(r.finish());
}
const h = JSON.parse(out.stdout.trim().split("\n").pop());

r.section("Keadilan rotasi (aturan bebas)");
const terburuk = h.adil.reduce((a, b) => (b.selisih > a.selisih ? b : a));
r.ok(
  h.adil.every((x) => x.selisih <= 1),
  `selisih jumlah main maksimal 1 untuk 4–13 pemain × 1–2 lapangan (terburuk: ${terburuk.n} pemain/${terburuk.courts} lapangan → selisih ${terburuk.selisih})`
);

r.section("Masukan ekstrem tidak membuat macet");
r.ok(h.kosong.ronde === 0, "0 pemain menghasilkan jadwal kosong, bukan error");
r.ok(h.satu.ronde === 0, "1 pemain menghasilkan jadwal kosong");
r.ok(h.tiga_duo.ronde === 0, "3 pemain di format duo menghasilkan jadwal kosong");

r.section("Aturan gender menyisihkan pemain — harus terdeteksi");
// Ini BUKAN kesalahan algoritma: 3 wanita tidak bisa membentuk tim duo (butuh 4).
// Yang penting: keadaan ini terdeteksi supaya penyelenggara bisa diberi peringatan.
r.ok(h.sesama_4_3.nol === 3, `4 pria + 3 wanita, aturan "sesama gender": 3 pemain dapat 0 pertandingan (${h.sesama_4_3.jumlah.join(",")})`);
r.ok(
  h.campuran_8_2.nol === 0 && Math.max(...h.campuran_8_2.jumlah) - Math.min(...h.campuran_8_2.jumlah) >= 4,
  `8 pria + 2 wanita, aturan "campuran": semua kebagian tapi sangat timpang (${h.campuran_8_2.jumlah.join(",")})`
);

process.exit(r.finish());
