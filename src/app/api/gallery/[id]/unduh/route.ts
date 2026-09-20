import fs from "node:fs/promises";
import path from "node:path";
import { UPLOAD_DIR, db, type GalleryItem } from "@/lib/db";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", svg: "image/svg+xml" };

/** Nama berkas yang ramah saat tersimpan di perangkat: "Klinik akhir pekan" → "klinik-akhir-pekan.jpg". */
function filenameFor(title: string, ext: string) {
  const slug =
    title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "foto";
  return `${slug}.${ext}`;
}

/**
 * Mengunduh satu foto galeri.
 *
 * Perlu rute sendiri karena foto produksi tersimpan di Vercel Blob (origin berbeda), dan atribut
 * `download` pada <a> diabaikan browser untuk tautan lintas-origin — fotonya akan terbuka di tab
 * baru, bukan terunduh. Di sini isinya diambil server lalu dikirim ulang dari origin kita sendiri
 * dengan Content-Disposition: attachment.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await db.get<GalleryItem>(
    "SELECT * FROM gallery WHERE id = ? AND status = 'approved'",
    Number(id)
  );
  if (!item) return new Response("Not found", { status: 404 });

  const ext = (/\.([a-z0-9]+)(?:$|\?)/i.exec(item.src)?.[1] ?? "jpg").toLowerCase();
  const headers = {
    "Content-Type": TYPES[ext] ?? "application/octet-stream",
    "Content-Disposition": `attachment; filename="${filenameFor(item.title, ext)}"`,
    "Cache-Control": "public, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  };

  try {
    // Foto di Vercel Blob: diambil server lalu diteruskan. Pola URL dicocokkan ketat supaya
    // kolom src tidak bisa dipakai memaksa server menghubungi alamat lain (SSRF).
    if (/^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//.test(item.src)) {
      const upstream = await fetch(item.src);
      if (!upstream.ok || !upstream.body) return new Response("Not found", { status: 404 });
      return new Response(upstream.body, { headers });
    }
    // Foto unggahan lokal (/media/<nama>) dan aset bawaan (/gallery/<nama>) dibaca dari disk.
    const name = path.basename(item.src);
    if (item.src.startsWith("/media/") && /^[a-f0-9]{24}\.(jpg|png|webp)$/.test(name)) {
      return new Response(new Uint8Array(await fs.readFile(path.join(UPLOAD_DIR, name))), { headers });
    }
    if (item.src.startsWith("/gallery/") && /^[a-zA-Z0-9._-]+$/.test(name)) {
      return new Response(new Uint8Array(await fs.readFile(path.join(process.cwd(), "public", "gallery", name))), { headers });
    }
    return new Response("Not found", { status: 404 });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
