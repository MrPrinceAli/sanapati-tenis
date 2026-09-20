# Tes

Tes ujung-ke-ujung: aplikasi sungguhan dijalankan, lalu dikemudikan lewat browser sungguhan
(Chrome, via `playwright-core`). Tidak ada yang dipalsukan — database, server action, dan
unggahan berkas semuanya asli.

## Menjalankan

```bash
npm test                      # build, lalu jalankan semua suite
npm run test:cepat            # pakai build yang sudah ada (lebih cepat saat mengulang)
node tests/run.mjs galeri     # satu suite saja
```

Butuh **Google Chrome** terpasang di komputer. `playwright-core` sengaja dipakai tanpa
mengunduh browser sendiri, supaya `npm install` tidak jadi berat.

## Suite

| Nama | Berkas | Isi |
|---|---|---|
| `sapuan` | `suites/smoke.mjs` | Tiap halaman dibuka sebagai tamu, pemain, dan admin, dalam dua bahasa. Menangkap error server sekaligus peringatan React (key, hydration, DOM bersarang). |
| `error` | `suites/errors.mjs` | Halaman error, 404, dan tampilan memuat. Kegagalan dibuat nyata dengan menyembunyikan tabel sesaat. |
| `galeri` | `suites/gallery.mjs` | Unduh foto, unggah banyak berkas oleh admin, kiriman pengunjung tanpa akun, antrean persetujuan, dan batas antrean. |
| `rutin` | `suites/recurring.mjs` | Jadwal rutin mingguan klub: papan booking, kalender, penolakan server, hak istimewa admin. |
| `keamanan` | `suites/security.mjs` | Uji IDOR pada server action, plus pemeriksaan pada formulir unggah yang terbuka untuk umum. |

## Hal yang perlu diketahui sebelum menambah tes

**Database selalu dibuat ulang tiap jalankan.** Bukan sekadar kerapian: pemain punya batas
booking aktif, jadi database yang dipakai berulang akan membuat tes gagal karena batas itu,
bukan karena aplikasinya rusak. `run.mjs` menghapus `testdata/` lalu menyemai ulang.

**Proses build ikut menyentuh database.** Saat `next build`, halaman diprarender dan itu
memicu penyemaian dengan password admin acak. Karena itu `run.mjs` membangun memakai
`DATA_DIR` terpisah, lalu menyiapkan database uji sendiri dengan password yang diketahui.

**Uji IDOR wajib punya kontrol pembanding.** Server action dipanggil ulang dengan cookie
penyerang. Permintaan yang disusun sendiri dari nol akan ditolak Next.js sebelum sampai ke
pemeriksaan hak akses — hasilnya tes terlihat "aman" padahal tidak menguji apa pun. Karena
itu badan permintaan asli disalin apa adanya, dan setiap uji IDOR diikuti kontrol: permintaan
yang sama persis diulang dengan cookie **pemiliknya**. Kalau kontrol tidak berhasil mengubah
data, tesnya dinyatakan tidak konklusif. Jangan hapus kontrol ini.

**Status HTTP bukan penentu.** Next.js mengalirkan halaman, jadi halaman yang gagal tetap
berstatus 200 dan batas error mengambil alih di browser. Yang diperiksa adalah apa yang
dilihat pengunjung dan apa yang berubah di database.

## Variabel lingkungan

| Variabel | Default | Guna |
|---|---|---|
| `PORT` | `3217` | Port server uji. |
| `BASE_URL` | `http://localhost:3217` | Dipakai suite saat dijalankan sendiri. |
| `TEST_DB_URL` | `file:testdata/sanapati.db` | Database yang diperiksa langsung oleh tes. |
| `HEADED` | — | Isi `1` untuk melihat browsernya bekerja. |
