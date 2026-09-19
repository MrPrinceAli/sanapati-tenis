"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { BookingError, cancelBooking, createBooking } from "@/lib/bookings";
import { db, type GalleryItem, type User } from "@/lib/db";
import type { FormState } from "@/lib/form";
import { getI18n } from "@/lib/i18n-server";
import { GALLERY_CATEGORIES, SURFACES } from "@/lib/options";
import { createResetToken } from "@/lib/password-reset";
import { CLOSE_HOUR, EARLIEST_HOUR } from "@/lib/time";
import { MAX_GALLERY_BYTES, removeUpload, saveImage } from "@/lib/uploads";

// Server action adalah endpoint publik — setiap action wajib cek role sendiri.
async function admin(): Promise<User | null> {
  const user = await getCurrentUser();
  return user?.role === "admin" ? user : null;
}

export async function adminCancelBooking(_: FormState, form: FormData): Promise<FormState> {
  const { t } = await getI18n();
  const user = await admin();
  if (!user) return { error: t.errors.denied };
  try {
    await cancelBooking(
      Number(form.get("bookingId")),
      user,
      String(form.get("reason") ?? "").trim() || "Dibatalkan oleh admin",
    );
  } catch (e) {
    if (e instanceof BookingError) return { error: t.errors[e.code] };
    throw e;
  }
  revalidatePath("/admin", "layout");
  revalidatePath("/booking");
  return { ok: t.ok.bookingCancelled };
}

export async function saveCourt(_: FormState, form: FormData): Promise<FormState> {
  const { t } = await getI18n();
  if (!(await admin())) return { error: t.errors.denied };
  const id = Number(form.get("id")) || null;
  const name = String(form.get("name") ?? "").trim();
  const surface = String(form.get("surface") ?? "");
  const description = String(form.get("description") ?? "")
    .trim()
    .slice(0, 300);
  const indoor = form.get("indoor") ? 1 : 0;
  const active = form.get("active") ? 1 : 0;
  const open = Number(form.get("open_hour"));
  const close = Number(form.get("close_hour"));

  if (name.length < 2 || name.length > 60) return { error: t.errors.courtName };
  if (!SURFACES.includes(surface)) return { error: t.errors.optionInvalid };
  if (!Number.isInteger(open) || !Number.isInteger(close) || open < EARLIEST_HOUR || close > CLOSE_HOUR || open >= close) {
    return { error: t.errors.hoursInvalid };
  }

  const values = [name, surface, indoor, description, active, open, close];
  if (id) {
    await db.run("UPDATE courts SET name=?, surface=?, indoor=?, description=?, active=?, open_hour=?, close_hour=? WHERE id=?", ...values, id);
  } else {
    await db.run("INSERT INTO courts (name, surface, indoor, description, active, open_hour, close_hour) VALUES (?,?,?,?,?,?,?)", ...values);
  }
  revalidatePath("/", "layout");
  return { ok: id ? t.ok.courtUpdated : t.ok.courtAdded };
}

export async function blockSlot(_: FormState, form: FormData): Promise<FormState> {
  const { t } = await getI18n();
  const user = await admin();
  if (!user) return { error: t.errors.denied };
  try {
    await createBooking({
      user,
      kind: "block",
      courtId: Number(form.get("courtId")),
      date: String(form.get("date") ?? ""),
      start: Number(form.get("start")),
      end: Number(form.get("end")),
      note: String(form.get("note") ?? "").trim() || "Maintenance",
    });
  } catch (e) {
    if (e instanceof BookingError) return { error: t.errors[e.code] };
    throw e;
  }
  revalidatePath("/admin", "layout");
  revalidatePath("/booking");
  return { ok: t.ok.slotBlocked };
}

export async function removeBlock(form: FormData) {
  if (!(await admin())) return;
  await db.run("DELETE FROM bookings WHERE id = ? AND kind = 'block'", Number(form.get("bookingId")));
  revalidatePath("/admin", "layout");
  revalidatePath("/booking");
}

export async function addGalleryItem(_: FormState, form: FormData): Promise<FormState> {
  const { t } = await getI18n();
  if (!(await admin())) return { error: t.errors.denied };
  const title = String(form.get("title") ?? "").trim();
  const category = String(form.get("category") ?? "");
  const file = form.get("file");

  if (title.length < 2 || title.length > 80) return { error: t.errors.titleMin };
  if (!GALLERY_CATEGORIES.includes(category)) return { error: t.errors.optionInvalid };
  const saved = await saveImage(file, MAX_GALLERY_BYTES);
  if ("error" in saved) return { error: t.errors[saved.error] };
  await db.run("INSERT INTO gallery (title, category, src) VALUES (?,?,?)", title, category, saved.src);
  revalidatePath("/galeri");
  revalidatePath("/admin/galeri");
  revalidatePath("/");
  return { ok: t.ok.photoAdded };
}

export async function deleteGalleryItem(form: FormData) {
  if (!(await admin())) return;
  const item = await db.get<GalleryItem>("SELECT * FROM gallery WHERE id = ?", Number(form.get("id")));
  if (!item) return;
  await db.run("DELETE FROM gallery WHERE id = ?", item.id);
  await removeUpload(item.src); // aset bawaan (/gallery/…) diabaikan oleh removeUpload
  revalidatePath("/galeri");
  revalidatePath("/admin/galeri");
  revalidatePath("/");
}

export async function deleteUser(_: FormState, form: FormData): Promise<FormState> {
  const { t } = await getI18n();
  const me = await admin();
  if (!me) return { error: t.errors.denied };
  const id = Number(form.get("userId"));
  if (id === me.id) return { error: t.errors.cannotDeleteSelf };
  const target = await db.get<Pick<User, "id" | "role" | "avatar">>("SELECT id, role, avatar FROM users WHERE id = ?", id);
  if (!target) return { error: t.errors.userNotFound };
  if (target.role === "admin") return { error: t.errors.cannotDeleteAdmin };

  // Satu batch atomik, urutannya mengikuti foreign key: semua yang merujuk ke user dihapus/dialihkan dulu.
  // Sesi mabar adalah catatan komunitas: tidak ikut dihapus, kepemilikannya dialihkan ke admin ini.
  await db.batch([
    { sql: "DELETE FROM bookings WHERE user_id = ?", args: [id] },
    { sql: "DELETE FROM password_resets WHERE user_id = ?", args: [id] },
    { sql: "UPDATE mm_sessions SET owner_id = ? WHERE owner_id = ?", args: [me.id, id] },
    { sql: "DELETE FROM users WHERE id = ?", args: [id] },
  ]);
  if (target.avatar) await removeUpload(target.avatar);
  revalidatePath("/", "layout");
  return { ok: t.ok.userDeleted };
}

// Jalur reset tanpa layanan email: admin membuat link lalu mengirimkannya sendiri ke pemain.
export async function createResetLink(_: FormState, form: FormData): Promise<FormState> {
  const { t } = await getI18n();
  if (!(await admin())) return { error: t.errors.denied };
  const user = await db.get<{ id: number }>("SELECT id FROM users WHERE id = ?", Number(form.get("userId")));
  if (!user) return { error: t.errors.userNotFound };
  return { ok: await createResetToken(user.id), values: { kind: "link" } };
}
