"use client";

import { useActionState, useEffect, useRef } from "react";
import { adminCancelBooking } from "@/app/actions/admin";
import { useI18n } from "../I18nProvider";
import { FormMessage, SubmitButton } from "../ui";

export function AdminCancelDialog({ bookingId, summary }: { bookingId: number; summary: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, action] = useActionState(adminCancelBooking, null);
  const { t } = useI18n();

  useEffect(() => {
    if (state?.ok) ref.current?.close();
  }, [state]);

  return (
    <>
      <button className="btn btn-ghost btn-sm text-clay-700 hover:border-clay-600 hover:text-clay-700" onClick={() => ref.current?.showModal()}>
        {t.cancel.button}
      </button>
      <dialog
        ref={ref}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-3xl border border-line bg-white p-0 text-ink backdrop:bg-court-950/50"
        onClick={(e) => e.target === ref.current && ref.current?.close()}
      >
        <form action={action} className="space-y-4 p-6 text-left">
          <input type="hidden" name="bookingId" value={bookingId} />
          <div>
            <h2 className="text-xl font-bold">{t.admin.bookings.cancelTitle}</h2>
            <p className="mt-1 text-sm text-muted">{summary}</p>
          </div>
          <div>
            <label htmlFor={`admin-reason-${bookingId}`} className="label">{t.admin.bookings.cancelReason}</label>
            <input id={`admin-reason-${bookingId}`} name="reason" required maxLength={200} className="input" placeholder={t.admin.bookings.cancelReasonPh} />
          </div>
          <FormMessage state={state?.error ? state : null} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => ref.current?.close()}>
              {t.common.close}
            </button>
            <SubmitButton className="btn btn-danger" pendingText={t.cancel.pending}>
              {t.admin.bookings.cancelSubmit}
            </SubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}
