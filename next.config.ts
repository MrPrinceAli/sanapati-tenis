import type { NextConfig } from "next";

// Content-Security-Policy: pertahanan berlapis terhadap injeksi & clickjacking.
// 'unsafe-inline' pada script/style diperlukan Next.js App Router (hydration inline) dan Tailwind;
// itu sebabnya XSS ditutup di sisi input (tidak ada dangerouslySetInnerHTML di kode), CSP hanya lapis kedua.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'", // situs tidak boleh di-iframe siapa pun → anti-clickjacking
  "form-action 'self'",
  "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"),
  "connect-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" }, // cadangan CSP untuk browser lama
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  // HSTS: paksa HTTPS 2 tahun. Vercel selalu HTTPS; di lokal (http) header ini diabaikan browser.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  // Jangan umumkan framework yang dipakai (pengurangan information disclosure).
  poweredByHeader: false,
  // Upload foto lewat server action. Vercel membatasi badan request 4,5 MB, jadi foto dibatasi 4 MB (lihat lib/uploads.ts).
  experimental: { serverActions: { bodySizeLimit: "4.5mb" } },
  // Foto yang diunggah di produksi tersimpan di Vercel Blob.
  images: { remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }] },
  // Build uji bisa diarahkan ke folder lain supaya tidak menimpa .next milik `npm run dev` yang sedang jalan.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
