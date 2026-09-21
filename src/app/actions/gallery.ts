"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { FormState } from "@/lib/form";
import { MAX_PENDING, countPending, titleFromFilename } from "@/lib/gallery";
import { getI18n } from "@/lib/i18n-server";
import { GALLERY_CATEGORIES } from "@/lib/options";
import { getSettings } from "@/lib/settings";
import { MAX_TAMU_BYTES } from "@/lib/upload-limits";
import { saveImage } from "@/lib/uploads";

// Peredam laju per alamat IP (15 per 10 menit), pola yang sama dengan aksi mabar terbuka.
// Angkanya dipilih agar orang yang baru selesai main dan mengirim selusin foto tidak terblokir,
// tapi pengiriman bertubi-tubi tetap berhenti.
// Catatan jujur: hitungannya ada di memori proses, jadi di serverless tiap instance punya
// hitungan sendiri — ini memperlambat penyalahgunaan, bukan menghentikannya. Pagar yang
// sebenarnya tetap MAX_PENDING, karena itu tersimpan di database.
const kiriman = new Map<string, { count: number; resetAt: number }>();
async function terlaluCepat(): Promise<boolean> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "local";
  const now = Date.now();
  const entry = kiriman.get(ip);
  if (!entry || entry.resetAt < now) {
    if (kiriman.size > 5000) kiriman.clear();
    kiriman.set(ip, { count: 1, resetAt: now + 10 * 60_000 });
    return false;
  }
  return ++entry.count > 15;
}

/**
 * Kiriman foto dari pengunjung, tanpa perlu akun.
 *
 * Sengaja TIDAK langsung tampil: foto masuk berstatus 'pending' sampai admin menyetujui.
 * Formulir terbuka untuk umum, jadi tanpa antrean ini siapa pun di internet bisa menayangkan
 * gambar apa pun atas nama klub. Perlindungan berlapisnya: saklar publicUploads di pengaturan,
 * batas panjang antrean, batas ukuran file, dan jenis file diperiksa dari magic bytes (lihat lib/uploads.ts).
 *
 * Perlindungan CSRF datang dari Next.js sendiri: server action menolak request lintas-origin.
 */
export async function submitGalleryPhoto(_: FormState, form: FormData): Promise<FormState> {
  const { t } = await getI18n();
  const settings = await getSettings();
  if (!settings.publicUploads) return { error: t.errors.uploadsClosed };
  if (await terlaluCepat()) return { error: t.errors.queueFull };
  if ((await countPending()) >= MAX_PENDING) return { error: t.errors.queueFull };

  const uploader = String(form.get("uploader") ?? "").trim().slice(0, 40);
  const title = String(form.get("title") ?? "").trim();
  const category = String(form.get("category") ?? "");
  const file = form.get("file");
  const values = { uploader, title, category };

  if (title && (title.length < 2 || title.length > 80)) return { error: t.errors.titleMin, values };
  if (!GALLERY_CATEGORIES.includes(category)) return { error: t.errors.optionInvalid, values };

  const saved = await saveImage(file, MAX_TAMU_BYTES);
  if ("error" in saved) return { error: t.errors[saved.error], values };

  const finalTitle =
    title || (file instanceof File ? titleFromFilename(file.name, t.gallery.photoTitle) : t.gallery.photoTitle);
  await db.run(
    "INSERT INTO gallery (title, category, src, status, uploader) VALUES (?,?,?,'pending',?)",
    finalTitle,
    category,
    saved.src,
    uploader
  );
  revalidatePath("/admin/galeri");
  return { ok: t.ok.photoSubmitted };
}
