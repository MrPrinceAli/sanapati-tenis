import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Upload foto galeri lewat server action (maks 5 MB + overhead form).
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  // Build uji bisa diarahkan ke folder lain supaya tidak menimpa .next milik `npm run dev` yang sedang jalan.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
