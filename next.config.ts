import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Upload foto lewat server action. Vercel membatasi badan request 4,5 MB, jadi foto dibatasi 4 MB (lihat lib/uploads.ts).
  experimental: { serverActions: { bodySizeLimit: "4.5mb" } },
  // Foto yang diunggah di produksi tersimpan di Vercel Blob.
  images: { remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }] },
  // Build uji bisa diarahkan ke folder lain supaya tidak menimpa .next milik `npm run dev` yang sedang jalan.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
