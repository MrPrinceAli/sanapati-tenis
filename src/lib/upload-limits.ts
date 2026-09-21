/**
 * Batas ukuran unggahan. Dipakai dua sisi, jadi berkas ini sengaja TIDAK "server-only":
 * server (lib/uploads.ts) menolak file yang lewat batas, klien (FileField di components/ui.tsx)
 * memperingatkan sejak file dipilih, sebelum tombol kirim ditekan.
 *
 * Vercel membatasi badan request fungsi di 4,5 MB (lihat serverActions.bodySizeLimit di
 * next.config.ts), jadi semua angka di bawah ini harus muat di dalamnya.
 */

export const MAX_GALLERY_BYTES = 4 * 1024 * 1024;
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/**
 * Kiriman tanpa akun dibatasi lebih ketat daripada unggahan admin: 2 MB, bukan 4 MB.
 * Foto ponsel biasa masih lolos, tapi biaya satu permintaan iseng jadi separuhnya.
 */
export const MAX_TAMU_BYTES = 2 * 1024 * 1024;

/**
 * Batas jumlah foto dalam satu kali unggah admin. Tidak ada hubungannya dengan batas ukuran
 * request: formulir mengirim satu foto per request (lihat addGalleryPhoto), jadi jumlahnya
 * sebenarnya bebas. Angka ini semata rem kewarasan — 50 foto berarti 50 request berurutan
 * dan tab yang harus dibiarkan terbuka sekian menit.
 */
export const MAX_FILES_PER_UPLOAD = 20;
