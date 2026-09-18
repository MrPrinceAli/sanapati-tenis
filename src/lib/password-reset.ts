import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { db, type User } from "./db";

const TTL_MS = 60 * 60 * 1000;
export const MAX_REQUESTS_PER_HOUR = 3;

// Yang disimpan hanya hash: kalau database bocor, link reset yang masih aktif tetap tidak bisa dipakai.
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

async function baseUrl(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export function recentRequestCount(userId: number): number {
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM password_resets WHERE user_id = ? AND created_at > ?")
    .get(userId, Date.now() - TTL_MS) as { n: number };
  return row.n;
}

/** Membuat token sekali-pakai dan mengembalikan link reset lengkap. */
export async function createResetToken(userId: number): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  db.prepare("INSERT INTO password_resets (user_id, token_hash, expires_at, created_at) VALUES (?,?,?,?)").run(
    userId,
    hash(token),
    now + TTL_MS,
    now
  );
  return `${await baseUrl()}/reset-password/${token}`;
}

export function findUserByResetToken(token: string): User | undefined {
  if (!/^[a-f0-9]{64}$/.test(token)) return undefined;
  return db
    .prepare(
      `SELECT u.* FROM password_resets r JOIN users u ON u.id = r.user_id
       WHERE r.token_hash = ? AND r.used_at IS NULL AND r.expires_at > ?`
    )
    .get(hash(token), Date.now()) as User | undefined;
}

/** Setelah password diganti, semua link reset milik user itu hangus. */
export function burnResetTokens(userId: number) {
  db.prepare("UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL").run(Date.now(), userId);
}

/**
 * Kirim email lewat Resend bila RESEND_API_KEY + MAIL_FROM diisi.
 * Tanpa itu, link ditulis ke log server (cukup untuk development) dan admin tetap bisa membuat link dari dashboard.
 */
export async function sendResetEmail(to: string, subject: string, text: string, link: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from) {
    console.info(`[reset-password] Layanan email belum diatur. Link untuk ${to}: ${link}`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text }),
    });
    if (!res.ok) console.error(`[reset-password] Gagal mengirim email (${res.status}): ${await res.text()}`);
  } catch (e) {
    console.error("[reset-password] Gagal menghubungi layanan email:", e);
  }
}
