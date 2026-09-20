import "server-only";
import { db } from "./db";

/**
 * Batas antrean kiriman pengunjung. Karena unggahan publik tidak butuh akun, batas inilah
 * yang menahan penyalahgunaan: begitu antrean penuh, kiriman baru ditolak sampai admin memeriksa.
 * Pembatas per-IP tidak dipakai karena di serverless hitungannya tersebar di banyak instance
 * (lihat catatan serupa pada pembatas login di actions/auth.ts).
 */
export const MAX_PENDING = 30;

/** Satu unggahan admin maksimal sekian file, supaya satu request tidak kebablasan. */
export const MAX_FILES_PER_UPLOAD = 20;

export const countPending = async () =>
  Number((await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM gallery WHERE status = 'pending'"))?.n ?? 0);

/**
 * Judul foto dari nama file saat pengunggah tidak mengisi judul.
 * "IMG_2043 lapangan-sore.JPG" → "IMG 2043 lapangan sore".
 */
export function titleFromFilename(name: string, fallback: string): string {
  const cleaned = name
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return cleaned.length >= 2 ? cleaned : fallback;
}
