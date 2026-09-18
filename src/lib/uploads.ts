import "server-only";
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { UPLOAD_DIR } from "./db";
import type { ErrorCode } from "./i18n";

// Jenis file ditentukan dari isi (magic bytes), bukan dari `file.type` yang dikirim browser dan bisa dipalsukan.
function sniff(bytes: Buffer): "jpg" | "png" | "webp" | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

export async function saveImage(file: unknown, maxBytes: number): Promise<{ filename: string } | { error: ErrorCode }> {
  if (!(file instanceof File) || file.size === 0) return { error: "chooseFile" };
  if (file.size > maxBytes) return { error: "fileSize" };
  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = sniff(bytes);
  if (!ext) return { error: "fileFormat" };

  // Nama acak 24 hex: pola ini juga yang divalidasi route /media/[name].
  const filename = `${randomBytes(12).toString("hex")}.${ext}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, filename), bytes);
  return { filename };
}

export async function removeUpload(filename: string) {
  if (!/^[a-f0-9]{24}\.(jpg|png|webp)$/.test(filename)) return;
  await fs.rm(path.join(UPLOAD_DIR, filename), { force: true });
}
