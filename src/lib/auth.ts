import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db, type User } from "./db";

const COOKIE = "sanapati_session";
const MAX_AGE = 60 * 60 * 24 * 30;

function secret(): Uint8Array {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET belum diatur (minimal 32 karakter). Lihat .env.example.");
    }
    return new TextEncoder().encode("dev-only-secret-jangan-dipakai-di-produksi");
  }
  return new TextEncoder().encode(value);
}

export async function createSession(userId: number) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(payload.uid as number) as User | undefined;
    if (!user || user.suspended) return null;
    // Sesi yang dibuat sebelum password diganti dianggap hangus (toleransi 1 detik karena `iat` berbasis detik).
    const changedAt = user.password_changed_at ? Date.parse(user.password_changed_at) : 0;
    if (changedAt && (payload.iat ?? 0) * 1000 < changedAt - 1000) return null;
    return user;
  } catch {
    return null;
  }
});

export async function requireUser(next: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(`/masuk?next=${encodeURIComponent(next)}`);
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser("/admin");
  if (user.role !== "admin") redirect("/");
  return user;
}

// Hanya izinkan redirect ke path internal.
export function safeNext(next: unknown, fallback = "/booking-saya"): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return fallback;
  }
  return next;
}
