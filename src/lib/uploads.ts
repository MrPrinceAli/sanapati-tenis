import "server-only";
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { UPLOAD_DIR } from "./db";
import type { ErrorCode } from "./i18n";

// Angka batasnya ada di lib/upload-limits.ts karena formulir di sisi klien memakainya juga.

const MIME = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;

// Jenis file ditentukan dari isi (magic bytes), bukan dari `file.type` yang dikirim browser dan bisa dipalsukan.
function sniff(bytes: Buffer): keyof typeof MIME | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

// Dengan BLOB_READ_WRITE_TOKEN (otomatis ada begitu Blob store dihubungkan di Vercel) file disimpan di Vercel Blob;
// tanpa itu ke disk lokal dan disajikan lewat route /media/[name].
const blobEnabled = () => !!process.env.BLOB_READ_WRITE_TOKEN;

/** Mengembalikan `src` siap pakai di <img>: URL Blob (https://…) atau path lokal (/media/…). */
export async function saveImage(file: unknown, maxBytes: number): Promise<{ src: string } | { error: ErrorCode }> {
  if (!(file instanceof File) || file.size === 0) return { error: "chooseFile" };
  if (file.size > maxBytes) return { error: "fileSize" };
  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = sniff(bytes);
  if (!ext) return { error: "fileFormat" };

  // Nama acak 24 hex: pola ini juga yang divalidasi route /media/[name].
  const filename = `${randomBytes(12).toString("hex")}.${ext}`;
  if (blobEnabled()) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`uploads/${filename}`, bytes, { access: "public", contentType: MIME[ext], addRandomSuffix: false });
    return { src: blob.url };
  }
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, filename), bytes);
  return { src: `/media/${filename}` };
}

export async function removeUpload(src: string) {
  if (!src) return;
  try {
    if (/^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//.test(src)) {
      if (!blobEnabled()) return;
      const { del } = await import("@vercel/blob");
      await del(src);
      return;
    }
    // Lama: avatar disimpan sebagai nama file saja; baru: "/media/<nama>". Aset bawaan (/gallery/…) tidak pernah dihapus.
    const name = path.basename(src);
    if ((src === name || src.startsWith("/media/")) && /^[a-f0-9]{24}\.(jpg|png|webp)$/.test(name)) {
      await fs.rm(path.join(UPLOAD_DIR, name), { force: true });
    }
  } catch (e) {
    // Gagal menghapus file bukan alasan untuk menggagalkan aksi pengguna; cukup dicatat.
    console.error("[uploads] gagal menghapus", src, e);
  }
}
