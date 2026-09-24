# Berkontribusi ke Sanapati Tenis

Terima kasih sudah tertarik! Laporan bug, ide fitur, dan pull request sangat diterima.

## Sebelum mulai

- Cek [issue yang ada](https://github.com/MrPrinceAli/sanapati-tenis/issues) agar tidak dobel.
- Untuk perubahan yang lebih besar dari perbaikan kecil, buka issue dulu supaya pendekatannya disepakati.

## Menyiapkan lingkungan

Ikuti bagian [Menjalankan](README.md#menjalankan) di README:

```bash
npm install
npm run dev          # http://localhost:3000
```

Database SQLite beserta data contoh dibuat otomatis saat pertama kali diakses.

## Sebelum membuka pull request

```bash
npm run lint
```bash
npm test             # build, lalu lima suite tes lewat Chrome
```

- Perlu Chrome terpasang untuk menjalankan tes. Rinciannya di [tests/README.md](tests/README.md).
- Perubahan skema database ditambahkan lewat migrasi aditif di `src/lib/db.ts`; jangan mengubah tabel yang ada secara destruktif.
- Teks antarmuka baru harus tersedia dalam dua bahasa (ID/EN).
- Satu PR untuk satu perubahan. Jelaskan **apa** yang diubah dan **mengapa**.

## Pesan commit

Ringkasan singkat dalam bentuk perintah, misalnya `Tambah filter lapangan` atau `Perbaiki kalender di Safari`.
