"use client";

import { useActionState, useEffect, useRef } from "react";
import { cancelMyBooking } from "@/app/actions/booking";
import { opt } from "@/lib/i18n";
import { CANCEL_REASONS } from "@/lib/options";
import { useI18n } from "./I18nProvider";
import { FormMessage, SubmitButton } from "./ui";

export function CancelDialog({ bookingId, summary }: { bookingId: number; summary: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, action] = useActionState(cancelMyBooking, null);
  const { t } = useI18n();

  useEffect(() => {
    if (state?.ok) ref.current?.close();
  }, [state]);

  return (
    <>
      <button
        className="btn btn-ghost btn-sm text-clay-700 hover:border-clay-600 hover:text-clay-700"
        onClick={() => ref.current?.showModal()}
      >
        {t.cancel.button}
      </button>
      <dialog
        ref={ref}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-3xl border border-line bg-white p-0 text-ink backdrop:bg-court-950/50 backdrop:backdrop-blur-sm"
        onClick={(e) => e.target === ref.current && ref.current?.close()}
      >
        <form action={action} className="space-y-4 p-6">
          <input type="hidden" name="bookingId" value={bookingId} />
          <div>
            <h2 className="text-2xl font-bold">{t.cancel.title}</h2>
            <p className="mt-1 text-sm text-muted">{summary}</p>
          </div>
          <div>
            <label htmlFor={`reason-${bookingId}`} className="label">
              {t.cancel.reason}
            </label>
            <select id={`reason-${bookingId}`} name="reason" required className="input" defaultValue="">
              <option value="" disabled>
                {t.cancel.choose}
              </option>
              {CANCEL_REASONS.map((r) => (
                <option key={r} value={r}>
                  {opt(t, r)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`detail-${bookingId}`} className="label">
              {t.cancel.detail} <span className="font-normal text-muted">{t.common.optional}</span>
            </label>
            <textarea id={`detail-${bookingId}`} name="detail" rows={2} maxLength={200} className="input resize-none" />
          </div>
          <p className="rounded-xl bg-sand px-3.5 py-2.5 text-xs text-muted">{t.cancel.warning}</p>
          <FormMessage state={state?.error ? state : null} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => ref.current?.close()}>
              {t.cancel.keep}
            </button>
            <SubmitButton className="btn btn-danger" pendingText={t.cancel.pending}>
              {t.cancel.confirm}
            </SubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}
