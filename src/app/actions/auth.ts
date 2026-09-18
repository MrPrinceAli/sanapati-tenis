"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { createSession, destroySession, safeNext } from "@/lib/auth";
import { db, type User } from "@/lib/db";
import type { FormState } from "@/lib/form";
import { getI18n } from "@/lib/i18n-server";
import { LEVELS } from "@/lib/options";
import {
  MAX_REQUESTS_PER_HOUR,
  burnResetTokens,
  createResetToken,
  findUserByResetToken,
  recentRequestCount,
  sendResetEmail,
} from "@/lib/password-reset";
import { getSettings } from "@/lib/settings";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Pembatas percobaan login sederhana (per email, di memori proses).
const attempts = new Map<string, { count: number; resetAt: number }>();
function tooManyAttempts(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + 10 * 60_000 });
    return false;
  }
  entry.count++;
  return entry.count > 8;
}

export async function register(_: FormState, form: FormData): Promise<FormState> {
  const { t } = await getI18n();
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const phone = String(form.get("phone") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const level = String(form.get("level") ?? "Pemula");

  const fail = (error: string): FormState => ({ error, values: { name, email, phone, level } });
  if (!getSettings().registrationOpen) return fail(t.errors.registrationClosed);
  if (name.length < 2 || name.length > 60) return fail(t.errors.nameMin);
  if (!EMAIL_RE.test(email) || email.length > 120) return fail(t.errors.emailInvalid);
  if (!/^[0-9+\-\s]{8,16}$/.test(phone)) return fail(t.errors.phoneInvalid);
  if (password.length < 8 || password.length > 72) return fail(t.errors.pwMin);
  if (!LEVELS.includes(level)) return fail(t.errors.optionInvalid);

  if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(email)) return fail(t.errors.emailTaken);
  const hash = await bcrypt.hash(password, 10);
  const hue = Math.floor(Math.random() * 360);
  const info = db
    .prepare("INSERT INTO users (name, email, phone, password_hash, level, avatar_hue) VALUES (?,?,?,?,?,?)")
    .run(name, email, phone, hash, level, hue);
  await createSession(Number(info.lastInsertRowid));
  redirect(safeNext(form.get("next"), "/booking"));
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const { t } = await getI18n();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: t.errors.fillLogin };
  if (tooManyAttempts(email)) return { error: t.errors.tooMany, values: { email } };

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as User | undefined;
  const ok = user ? await bcrypt.compare(password, user.password_hash) : false;
  if (!user || !ok) return { error: t.errors.wrongLogin, values: { email } };
  // Dicek setelah password benar, supaya status akun tidak bocor ke orang yang hanya menebak email.
  if (user.suspended) return { error: t.errors.suspendedLogin, values: { email } };

  attempts.delete(email);
  await createSession(user.id);
  redirect(safeNext(form.get("next"), user.role === "admin" ? "/admin" : "/booking-saya"));
}

export async function logout() {
  await destroySession();
  redirect("/");
}

export async function requestPasswordReset(_: FormState, form: FormData): Promise<FormState> {
  const { t } = await getI18n();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: t.errors.emailInvalid, values: { email } };

  // Jawaban selalu sama, terdaftar atau tidak, supaya form ini tidak bisa dipakai mengecek email siapa yang punya akun.
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as User | undefined;
  if (user && recentRequestCount(user.id) < MAX_REQUESTS_PER_HOUR) {
    const link = await createResetToken(user.id);
    await sendResetEmail(user.email, t.reset.mailSubject, t.reset.mailBody(user.name, link), link);
  }
  return { ok: t.reset.sent };
}

export async function resetPassword(_: FormState, form: FormData): Promise<FormState> {
  const { t } = await getI18n();
  const user = findUserByResetToken(String(form.get("token") ?? ""));
  if (!user) return { error: t.errors.resetInvalid };
  const password = String(form.get("password") ?? "");
  if (password.length < 8 || password.length > 72) return { error: t.errors.pwMin };

  db.prepare("UPDATE users SET password_hash = ?, password_changed_at = ? WHERE id = ?").run(
    await bcrypt.hash(password, 10),
    new Date().toISOString(),
    user.id
  );
  burnResetTokens(user.id);
  attempts.delete(user.email);
  redirect("/masuk?reset=1");
}
