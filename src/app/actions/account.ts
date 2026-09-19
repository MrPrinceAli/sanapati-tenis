"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { createSession, getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { FormState } from "@/lib/form";
import { getI18n } from "@/lib/i18n-server";
import { BACKHANDS, HANDS, LEVELS, REMINDER_MINUTES } from "@/lib/options";
import { burnResetTokens } from "@/lib/password-reset";
import { MAX_AVATAR_BYTES, removeUpload, saveImage } from "@/lib/uploads";

export async function updateAccount(_: FormState, form: FormData): Promise<FormState> {
  const { t } = await getI18n();
  const user = await getCurrentUser();
  if (!user) return { error: t.errors.sessionExpired };

  const name = String(form.get("name") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();
  const reminder = Number(form.get("reminder_minutes"));
  if (name.length < 2 || name.length > 60) return { error: t.errors.nameMin };
  if (!/^[0-9+\-\s]{8,16}$/.test(phone)) return { error: t.errors.phoneInvalid };
  if (!REMINDER_MINUTES.includes(reminder)) return { error: t.errors.optionInvalid };

  await db.run("UPDATE users SET name = ?, phone = ?, reminder_minutes = ? WHERE id = ?", name, phone, reminder, user.id);
  revalidatePath("/", "layout");
  return { ok: t.ok.accountSaved };
}

export async function updateProfile(_: FormState, form: FormData): Promise<FormState> {
  const { t } = await getI18n();
  const user = await getCurrentUser();
  if (!user) return { error: t.errors.sessionExpired };

  const level = String(form.get("level") ?? "");
  const hand = String(form.get("hand") ?? "");
  const backhand = String(form.get("backhand") ?? "");
  const city = String(form.get("city") ?? "").trim().slice(0, 60);
  const bio = String(form.get("bio") ?? "").trim().slice(0, 280);
  const hue = Math.min(359, Math.max(0, Math.round(Number(form.get("avatar_hue")) || 0)));
  if (!LEVELS.includes(level) || !HANDS.includes(hand) || !BACKHANDS.includes(backhand)) {
    return { error: t.errors.optionInvalid };
  }

  await db.run("UPDATE users SET level = ?, hand = ?, backhand = ?, city = ?, bio = ?, avatar_hue = ?, is_public = ? WHERE id = ?", level, hand, backhand, city, bio, hue, form.get("is_public") ? 1 : 0, user.id);
  revalidatePath("/", "layout");
  return { ok: t.ok.profileSaved };
}

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const { t } = await getI18n();
  const user = await getCurrentUser();
  if (!user) return { error: t.errors.sessionExpired };

  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  if (!(await bcrypt.compare(current, user.password_hash))) return { error: t.errors.wrongCurrentPw };
  if (next.length < 8 || next.length > 72) return { error: t.errors.pwMin };

  await db.run("UPDATE users SET password_hash = ?, password_changed_at = ? WHERE id = ?", await bcrypt.hash(next, 10),
    new Date().toISOString(),
    user.id);
  await burnResetTokens(user.id);
  // Sesi di perangkat lain hangus; perangkat ini langsung diberi sesi baru supaya tidak ikut ter-logout.
  await createSession(user.id);
  return { ok: t.ok.passwordChanged };
}

export async function updateAvatar(_: FormState, form: FormData): Promise<FormState> {
  const { t } = await getI18n();
  const user = await getCurrentUser();
  if (!user) return { error: t.errors.sessionExpired };

  if (form.get("remove")) {
    await db.run("UPDATE users SET avatar = '' WHERE id = ?", user.id);
    if (user.avatar) await removeUpload(user.avatar);
    revalidatePath("/", "layout");
    return { ok: t.ok.avatarRemoved };
  }
  const saved = await saveImage(form.get("file"), MAX_AVATAR_BYTES);
  if ("error" in saved) return { error: t.errors[saved.error] };
  await db.run("UPDATE users SET avatar = ? WHERE id = ?", saved.src, user.id);
  if (user.avatar) await removeUpload(user.avatar);
  revalidatePath("/", "layout");
  return { ok: t.ok.avatarSaved };
}
