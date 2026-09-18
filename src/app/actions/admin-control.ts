"use server";

// Kontrol penuh admin: booking atas nama pemain, data pengguna, hapus lapangan, galeri, mabar, dan pengaturan situs.
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { BookingError, createBooking, deleteBooking, moveBooking, restoreBooking } from "@/lib/bookings";
import { db, type User } from "@/lib/db";
import type { FormState } from "@/lib/form";
import { getI18n } from "@/lib/i18n-server";
import { BACKHANDS, GALLERY_CATEGORIES, HANDS, LEVELS } from "@/lib/options";
import { burnResetTokens } from "@/lib/password-reset";
import { RULE_BOUNDS, type Rules } from "@/lib/rules";
import { saveSettings } from "@/lib/settings";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+\-\s]{8,16}$/;

// Server action adalah endpoint publik — setiap action wajib cek role sendiri.
async function admin(): Promise<User | null> {
  const user = await getCurrentUser();
  return user?.role === "admin" ? user : null;
}

const refreshBookings = () => {
  revalidatePath("/admin", "layout");
  revalidatePath("/booking");
  revalidatePath("/jadwal");
};

const slotFrom = (form: FormData) => ({
  courtId: Number(form.get("courtId")),
  date: String(form.get("date") ?? ""),
  start: Number(form.get("start")),
  end: Number(form.get("end")),
  note: String(form.get("note") ?? "").trim(),
});

// ---------- Booking ----------

export async function adminCreateBooking(_: FormState, form: FormData): Promise<FormState> {
  const { t } = await getI18n();
  if (!(await admin())) return { error: t.errors.denied };
  const player = db.prepare("SELECT * FROM users WHERE id = ?").get(Number(form.get("userId"))) as User | undefined;
  if (!player) return { error: t.errors.chooseUser };
  try {
    createBooking({ user: player, ...slotFrom(form), bypassRules: true });
  } catch (e) {
    if (e instanceof BookingError) return { error: t.errors[e.code] };
    throw e;
  }
  refreshBookings();
  return { ok: t.ok.bookingCreated };
}

export async function adminMoveBooking(_: FormState, form: FormData): Promise<FormState> {
  const { t } = await getI18n();
  if (!(await admin())) return { error: t.errors.denied };
  try {
    moveBooking(Number(form.get("bookingId")), slotFrom(form));
  } catch (e) {
    if (e instanceof BookingError) return { error: t.errors[e.code] };
    throw e;
  }
  refreshBookings();
  return { ok: t.ok.bookingUpdated };
}

export async function adminRestoreBooking(_: FormState, form: FormData): Promise<FormState> {
  const { t } = await getI18n();
  if (!(await admin())) return { error: t.errors.denied };
  try {
    restoreBooking(Number(form.get("bookingId")));
  } catch (e) {
    if (e instanceof BookingError) return { error: t.errors[e.code] };
    throw e;
  }
  refreshBookings();
  return { ok: t.ok.bookingRestored };
}

export async function adminDeleteBooking(form: FormData) {
  if (!(await admin())) return;
  deleteBooking(Number(form.get("bookingId")));
  refreshBookings();
}

// ---------- Pengguna ----------

export async function adminSaveUser(_: FormState, form: FormData): Promise<FormState> {
  const { t } = await getI18n();
  const me = await admin();
  if (!me) return { error: t.errors.denied };

  const id = Number(form.get("userId")) || null;
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const phone = String(form.get("phone") ?? "").trim();
  const level = String(form.get("level") ?? "");
  const hand = String(form.get("hand") ?? "Kanan");
  const backhand = String(form.get("backhand") ?? "Dua tangan");
  const city = String(form.get("city") ?? "").trim().slice(0, 60);
  const bio = String(form.get("bio") ?? "").trim().slice(0, 280);
  const role = form.get("role") === "admin" ? "admin" : "user";
  const suspended = form.get("suspended") ? 1 : 0;
  const isPublic = form.get("is_public") ? 1 : 0;
  const password = String(form.get("password") ?? "");

  if (name.length < 2 || name.length > 60) return { error: t.errors.nameMin };
  if (!EMAIL_RE.test(email) || email.length > 120) return { error: t.errors.emailInvalid };
  if (!PHONE_RE.test(phone)) return { error: t.errors.phoneInvalid };
  if (!LEVELS.includes(level) || !HANDS.includes(hand) || !BACKHANDS.includes(backhand)) return { error: t.errors.optionInvalid };
  if ((password || !id) && (password.length < 8 || password.length > 72)) return { error: t.errors.pwMin };
  const taken = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as { id: number } | undefined;
  if (taken && taken.id !== id) return { error: t.errors.emailTaken };

  if (!id) {
    const info = db
      .prepare(
        `INSERT INTO users (name, email, phone, password_hash, role, level, hand, backhand, city, bio, avatar_hue, is_public)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(name, email, phone, await bcrypt.hash(password, 10), role, level, hand, backhand, city, bio, Math.floor(Math.random() * 360), isPublic);
    revalidatePath("/", "layout");
    redirect(`/admin/pengguna/${info.lastInsertRowid}`);
  }

  // Admin tidak boleh menurunkan atau membekukan dirinya sendiri: bisa-bisa tidak ada lagi yang punya akses admin.
  if (id === me.id && (role !== "admin" || suspended)) return { error: t.errors.selfChange };
  if (!db.prepare("SELECT 1 FROM users WHERE id = ?").get(id)) return { error: t.errors.userNotFound };

  db.prepare(
    `UPDATE users SET name=?, email=?, phone=?, level=?, hand=?, backhand=?, city=?, bio=?, role=?, suspended=?, is_public=? WHERE id=?`
  ).run(name, email, phone, level, hand, backhand, city, bio, role, suspended, isPublic, id);
  if (password) {
    // Mengisi password_changed_at mematikan semua sesi lama pengguna itu (lihat getCurrentUser).
    db.prepare("UPDATE users SET password_hash = ?, password_changed_at = ? WHERE id = ?").run(
      await bcrypt.hash(password, 10),
      new Date().toISOString(),
      id
    );
    burnResetTokens(id);
  }
  revalidatePath("/", "layout");
  return { ok: t.ok.userSaved };
}

// ---------- Lapangan & galeri ----------

export async function deleteCourt(form: FormData) {
  if (!(await admin())) return;
  const id = Number(form.get("courtId"));
  db.transaction(() => {
    db.prepare("DELETE FROM bookings WHERE court_id = ?").run(id);
    db.prepare("DELETE FROM courts WHERE id = ?").run(id);
  })();
  revalidatePath("/", "layout");
}

export async function updateGalleryItem(_: FormState, form: FormData): Promise<FormState> {
  const { t } = await getI18n();
  if (!(await admin())) return { error: t.errors.denied };
  const title = String(form.get("title") ?? "").trim();
  const category = String(form.get("category") ?? "");
  if (title.length < 2 || title.length > 80) return { error: t.errors.titleMin };
  if (!GALLERY_CATEGORIES.includes(category)) return { error: t.errors.optionInvalid };
  db.prepare("UPDATE gallery SET title = ?, category = ? WHERE id = ?").run(title, category, Number(form.get("id")));
  revalidatePath("/galeri");
  revalidatePath("/admin/galeri");
  revalidatePath("/");
  return { ok: t.ok.photoUpdated };
}

// ---------- Mabar ----------

export async function adminSessionAction(form: FormData) {
  if (!(await admin())) return;
  const id = Number(form.get("sessionId"));
  const op = String(form.get("op"));
  if (op === "lock") db.prepare("UPDATE mm_sessions SET open_edit = 1 - open_edit WHERE id = ?").run(id);
  else if (op === "finish") db.prepare("UPDATE mm_sessions SET finished = 1 - finished WHERE id = ?").run(id);
  else if (op === "delete") {
    db.prepare("DELETE FROM mm_matches WHERE session_id = ?").run(id);
    db.prepare("DELETE FROM mm_sessions WHERE id = ?").run(id);
  }
  revalidatePath("/admin/mabar");
  revalidatePath("/mabar");
  revalidatePath(`/mabar/${id}`);
}

// ---------- Pengaturan situs ----------

export async function saveSiteSettings(_: FormState, form: FormData): Promise<FormState> {
  const { t } = await getI18n();
  if (!(await admin())) return { error: t.errors.denied };

  const rules = {} as Rules;
  for (const key of Object.keys(RULE_BOUNDS) as (keyof Rules)[]) {
    const n = Number(form.get(key));
    const [min, max] = RULE_BOUNDS[key];
    if (form.get(key) === "" || !Number.isInteger(n) || n < min || n > max) return { error: t.errors.settingsRange };
    rules[key] = n;
  }
  const contactEmail = String(form.get("contactEmail") ?? "").trim();
  if (contactEmail && !EMAIL_RE.test(contactEmail)) return { error: t.errors.emailInvalid };

  saveSettings({
    ...rules,
    registrationOpen: !!form.get("registrationOpen"),
    announcementId: String(form.get("announcementId") ?? "").trim().slice(0, 300),
    announcementEn: String(form.get("announcementEn") ?? "").trim().slice(0, 300),
    contactEmail,
  });
  revalidatePath("/", "layout");
  return { ok: t.ok.settingsSaved };
}
