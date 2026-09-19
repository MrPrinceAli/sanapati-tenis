"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { BookingError, cancelBooking, createBooking } from "@/lib/bookings";
import type { FormState } from "@/lib/form";
import { getI18n } from "@/lib/i18n-server";
import { CANCEL_REASONS } from "@/lib/options";

export async function bookSlot(_: FormState, form: FormData): Promise<FormState> {
  const { t } = await getI18n();
  const user = await getCurrentUser();
  if (!user) return { error: t.errors.sessionExpired };

  let code: string;
  try {
    const booking = await createBooking({
      user,
      courtId: Number(form.get("courtId")),
      date: String(form.get("date") ?? ""),
      start: Number(form.get("start")),
      end: Number(form.get("end")),
      note: String(form.get("note") ?? "").trim(),
    });
    code = booking.code;
  } catch (e) {
    if (e instanceof BookingError) return { error: t.errors[e.code] };
    throw e;
  }
  revalidatePath("/booking");
  redirect(`/booking-saya?baru=${code}`);
}

export async function cancelMyBooking(_: FormState, form: FormData): Promise<FormState> {
  const { t } = await getI18n();
  const user = await getCurrentUser();
  if (!user) return { error: t.errors.sessionExpired };

  const reason = String(form.get("reason") ?? "").trim();
  const detail = String(form.get("detail") ?? "").trim();
  if (!CANCEL_REASONS.includes(reason)) return { error: t.errors.chooseReason };
  try {
    await cancelBooking(Number(form.get("bookingId")), user, detail ? `${reason} — ${detail}` : reason);
  } catch (e) {
    if (e instanceof BookingError) return { error: t.errors[e.code] };
    throw e;
  }
  revalidatePath("/booking-saya");
  revalidatePath("/booking");
  return { ok: t.ok.bookingCancelled };
}
