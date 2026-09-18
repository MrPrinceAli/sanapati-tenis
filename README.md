# Sanapati Tenis

Website komunitas tenis dengan booking lapangan online — **gratis** (tanpa harga/pembayaran), dua lapangan: **Sawangan** dan **Ragunan**, dua bahasa (Indonesia/Inggris). Next.js 15 (App Router) + TypeScript + Tailwind CSS v4 + SQLite.

## Menjalankan

```bash
npm install
npm run dev          # http://localhost:3000
```

Database SQLite dibuat otomatis di `data/sanapati.db` saat pertama kali diakses, lengkap dengan data contoh
(2 lapangan, 5 pemain, booking 3 minggu terakhir, galeri). Hapus folder `data/` untuk mengulang dari awal.
Kolom/tabel baru ditambahkan lewat migrasi aditif di `src/lib/db.ts`, jadi update kode tidak menghapus data.

| Akun demo | Email | Password |
| --- | --- | --- |
| Admin | `admin@sanapati.id` | `admin123` |
| Pemain | `raka@contoh.id` (juga dinda/bima/sekar/yoga) | `tenis123` |

> **Sebelum produksi:** ganti password admin, hapus akun demo, dan isi `SESSION_SECRET` di `.env.local`
> (lihat `.env.example`; aplikasi menolak jalan di produksi tanpa secret ≥ 32 karakter).

## Fitur

| Fitur | Halaman | Catatan |
| --- | --- | --- |
| Landing page | `/` | Jumlah slot kosong hari ini real-time, daftar lapangan dari database |
| Booking | `/booking` | Papan lapangan × jam, pilih 1–3 jam berurutan, maksimal 14 hari ke depan |
| Jadwal (kalender) | `/jadwal` | Kalender bulanan + detail harian per lapangan, publik. Nama hanya tampil untuk pemain berprofil publik |
| Mabar / matchmaking | `/mabar` | Dashboard publik. Sesi mabar (rotasi adil) atau turnamen (gugur), solo/duo, aturan gender, target skor, rencana durasi, pemerataan jumlah main, input skor, klasemen/bagan otomatis |
| Booking saya | `/booking-saya` | Akan datang + riwayat, kode booking |
| Pembatalan | `/booking-saya` | Mandiri sampai 6 jam sebelum main, wajib pilih alasan; slot langsung dibuka lagi |
| Pengingat jadwal | lonceng di header | Toast di website + notifikasi browser + file kalender `.ics` ber-alarm; waktu pengingat diatur di `/akun` |
| Akun | `/daftar`, `/masuk`, `/akun` | Sesi JWT di cookie httpOnly, password bcrypt, ganti password, foto profil |
| Lupa password | `/lupa-password` | Link sekali-pakai (1 jam). Via email bila `RESEND_API_KEY` diisi; tanpa itu admin membuat link dari halaman Pengguna |
| Daftar & profil pemain | `/pemain`, `/pemain/[id]` | Level, gaya main, statistik jam main, lapangan favorit; bisa diset privat |
| Galeri | `/galeri` | Filter kategori + lightbox |
| Admin dashboard | `/admin` | Kontrol penuh, lihat bagian **Admin** di bawah |
| Dua bahasa | tombol `ID / EN` di header | Tersimpan di cookie; berlaku untuk semua halaman, pesan error, format tanggal/jam, dan file kalender |

## Admin

| Tab | Yang bisa dilakukan |
| --- | --- |
| Ringkasan | Statistik hari ini/bulan ini, grafik jam terbooking, okupansi per lapangan, jadwal hari ini |
| Booking | Cari/filter; **buat booking atas nama pemain** (tidak terkena aturan pemain), ubah/pindah jadwal & lapangan, batalkan, pulihkan, hapus permanen |
| Lapangan & Blokir | Tambah/ubah/nonaktifkan/**hapus** lapangan, jam buka per lapangan, blokir slot |
| Galeri | Unggah, ubah judul/kategori, hapus |
| Pengguna | Tambah pengguna; halaman kelola per user: ubah semua data + email, set password, role, **bekukan akun**, link reset, riwayat booking; hapus akun |
| Mabar | Semua sesi: kelola, kunci/buka, tandai selesai, hapus |
| Pengaturan | Aturan booking, buka/tutup pendaftaran, pengumuman (banner seluruh situs, 2 bahasa), email kontak |

Pengaman: admin tidak bisa menurunkan, membekukan, atau menghapus akunnya sendiri. Semua aksi yang tidak bisa diurungkan lewat dialog konfirmasi.
Setiap server action mengecek role sendiri — menyembunyikan tombol saja tidak dianggap pengamanan.

## Aturan bisnis

Aturan di bawah bisa diubah admin di **/admin/pengaturan** (tersimpan di tabel `settings`); nilai di [`src/lib/time.ts`](src/lib/time.ts) hanya default awal:

- Jam operasional default 06.00–23.00 **WIB** (zona waktu klub, tidak tergantung server/browser); bisa diatur per lapangan di admin
- Maksimal 3 jam per booking, 5 booking aktif per pemain, booking paling jauh 14 hari ke depan
- Batas pembatalan mandiri: 6 jam sebelum main (admin bisa membatalkan kapan saja)

Cek bentrok + insert berjalan dalam satu transaksi SQLite, jadi dua orang tidak bisa mengambil slot yang sama.

## Mabar / matchmaking

Logika pengacakan ada di [`src/lib/matchmaking.ts`](src/lib/matchmaking.ts) — fungsi murni tanpa database, jadi mudah diuji.

- **Mabar**: tiap ronde mendahulukan pemain yang paling sedikit main, lalu memilih susunan dengan pengulangan pasangan/lawan paling sedikit.
  Jumlah ronde = `durasi ÷ menit per match`; bila "semua main minimal N×" diisi, berhenti begitu target tercapai.
- **Turnamen**: sistem gugur; jumlah peserta yang bukan kelipatan 2 diberi *bye*; pemenang otomatis maju. Skor babak awal terkunci setelah babak berikutnya dimainkan.
- **Aturan gender**: bebas · sesama gender · mix (tiap tim 1 cowok + 1 cewek, khusus duo).
- Hak akses: **membuat sesi** butuh login. Setelah itu, selama sesi *terbuka* (default), **siapa pun tanpa login** bisa mengisi/mengubah skor,
  menambah pemain, dan membetulkan nama/gender. Acak ulang, ubah pengaturan, hapus pemain, tandai selesai, dan hapus sesi tetap khusus pembuat sesi + admin.
  Pembuat sesi bisa mengunci sesi (centang di "Ubah pengaturan"); sesi yang ditandai selesai otomatis terkunci. Tulisan anonim dibatasi 40/menit per IP.
- Nama pemain berupa teks bebas (tidak harus punya akun).

## Dua bahasa (i18n)

Semua teks ada di kamus [`src/lib/i18n.ts`](src/lib/i18n.ts) + [`src/lib/i18n-extra.ts`](src/lib/i18n-extra.ts) (`id` dan `en`; TypeScript memaksa keduanya punya kunci yang sama).

- Server component / action: `const { t, f } = await getI18n()` dari `lib/i18n-server.ts`
- Client component: `const { t, f } = useI18n()` dari `components/I18nProvider.tsx`
- `t` = teks, `f` = format tanggal/jam/hitung mundur sesuai bahasa
- Nilai pilihan (level, permukaan, kategori galeri, alasan batal) disimpan di database dalam bahasa Indonesia dan diterjemahkan saat tampil lewat `opt(t, nilai)`
- Konten yang diketik user/admin (bio, deskripsi lapangan, judul foto, catatan) tampil apa adanya, tidak diterjemahkan

## Struktur

```
src/lib/          db (skema + migrasi + seed), auth, bookings, time (WIB & aturan), i18n, matchmaking (mesin acak), mabar (data sesi),
                  password-reset, uploads (validasi isi file)
src/app/actions/  server actions: auth, booking, account, admin, mabar, locale — semua validasi & cek hak akses di sini
src/app/(site)/   halaman publik & pemain
src/app/admin/    dashboard admin (dijaga requireAdmin di layout + di setiap action)
src/app/api/      /api/reminders (data lonceng), /api/bookings/[code]/ics (kalender)
src/app/media/    menyajikan foto galeri hasil upload dari data/uploads
src/components/   komponen UI; yang interaktif bertanda "use client"
```

## Deploy

Aplikasi menulis ke disk (`data/`, atau folder lain lewat env `DATA_DIR`), jadi butuh hosting dengan penyimpanan persisten — VPS, Railway, Fly.io, atau Docker
dengan volume. **Tidak cocok** untuk Vercel/serverless tanpa mengganti SQLite ke database terkelola (mis. Postgres/Turso).

```bash
npm run build && npm run start
```

## Belum termasuk

- Pengingat via email/WhatsApp (butuh penyedia pihak ketiga + cron); pengingat saat ini berbasis browser & kalender
- Mabar: pemain berupa teks bebas, belum terhubung ke akun/profil pemain; turnamen baru sistem gugur (belum ada round-robin / perebutan juara 3)
