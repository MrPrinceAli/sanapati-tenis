"use client";

import { useEffect } from "react";

/**
 * Jaring terakhir: dipakai hanya bila layout root sendiri yang gagal, sehingga tag <html> dan <body>
 * harus dirender ulang di sini. Karena penyedia bahasa dan stylesheet ikut hilang bersama layout,
 * halaman ini sengaja memakai gaya inline dan teks tetap — tanpa ketergantungan apa pun yang bisa ikut gagal.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[global]", error);
  }, [error]);
  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fffdf5",
          color: "#0e3b2c",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          padding: "24px",
        }}
      >
        <main style={{ maxWidth: "26rem", textAlign: "center" }}>
          <svg width="56" height="56" viewBox="0 0 32 32" aria-hidden style={{ display: "block", margin: "0 auto" }}>
            <circle cx="16" cy="16" r="16" fill="#d8f24b" />
            <path
              d="M4.2 4.4c6.6 4.8 6.6 17.6 0 22.4M27.8 4.4c-6.6 4.8-6.6 17.6 0 22.4"
              fill="none"
              stroke="#0e3b2c"
              strokeWidth="2.7"
              strokeLinecap="round"
            />
          </svg>
          <h1 style={{ marginTop: "20px", fontSize: "1.35rem" }}>Situs sedang bermasalah</h1>
          <p style={{ marginTop: "8px", lineHeight: 1.6, color: "#5b6b63" }}>
            Ada gangguan di sisi kami. Coba muat ulang halaman ini sebentar lagi.
            <br />
            <span style={{ fontSize: "0.85rem" }}>Something went wrong on our side. Please try again shortly.</span>
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "24px",
              cursor: "pointer",
              borderRadius: "999px",
              border: "none",
              background: "#0e3b2c",
              color: "#fffdf5",
              padding: "11px 26px",
              fontSize: "0.95rem",
              fontWeight: 600,
            }}
          >
            Coba lagi / Try again
          </button>
          {error.digest && (
            <p style={{ marginTop: "28px", fontSize: "0.72rem", color: "#8a9791" }}>
              <code>{error.digest}</code>
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
