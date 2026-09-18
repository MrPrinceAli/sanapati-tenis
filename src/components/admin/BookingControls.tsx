"use client";

import { useActionState, useEffect, useRef } from "react";
import { adminCreateBooking, adminMoveBooking, adminRestoreBooking } from "@/app/actions/admin-control";
import { CLOSE_HOUR, EARLIEST_HOUR, hourRange } from "@/lib/time";
import { useI18n } from "../I18nProvider";
import { FormMessage, SubmitButton } from "../ui";

type CourtOption = { id: number; name: string };
type Slot = { courtId: number; date: string; start: number; end: number; note: string };

function SlotFields({ courts, slot, uid }: { courts: CourtOption[]; slot: Slot; uid: string }) {
  const { t, f } = useI18n();
  const a = t.adminX;
  return (
    <>
      <div>
        <label htmlFor={`court-${uid}`} className="label">{a.court}</label>
        <select key={slot.courtId} id={`court-${uid}`} name="courtId" defaultValue={slot.courtId} className="input">
          {courts.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`date-${uid}`} className="label">{a.date}</label>
        <input id={`date-${uid}`} name="date" type="date" defaultValue={slot.date} required className="input" />
      </div>
      <div>
        <label htmlFor={`start-${uid}`} className="label">{a.from}</label>
        <select key={slot.start} id={`start-${uid}`} name="start" defaultValue={slot.start} className="input">
          {hourRange(EARLIEST_HOUR, CLOSE_HOUR).map((h) => (
            <option key={h} value={h}>{f.hour(h)}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`end-${uid}`} className="label">{a.to}</label>
        <select key={slot.end} id={`end-${uid}`} name="end" defaultValue={slot.end} className="input">
          {hourRange(EARLIEST_HOUR + 1, CLOSE_HOUR + 1).map((h) => (
            <option key={h} value={h}>{f.hour(h)}</option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`note-${uid}`} className="label">
          {a.note} <span className="font-normal text-muted">{t.common.optional}</span>
        </label>
        <input id={`note-${uid}`} name="note" defaultValue={slot.note} maxLength={300} className="input" />
      </div>
    </>
  );
}

export function AdminCreateBookingForm({ users, courts, today }: { users: { id: number; name: string; email: string }[]; courts: CourtOption[]; today: string }) {
  const [state, action] = useActionState(adminCreateBooking, null);
  const { t } = useI18n();
  const a = t.adminX;
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-1">
          <label htmlFor="new-user" className="label">{a.player}</label>
          <select id="new-user" name="userId" required defaultValue="" className="input">
            <option value="" disabled>—</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name} · {u.email}</option>
            ))}
          </select>
        </div>
        <SlotFields courts={courts} uid="new" slot={{ courtId: courts[0]?.id ?? 0, date: today, start: 7, end: 8, note: "" }} />
      </div>
      <p className="text-xs text-muted">{a.bypassNote}</p>
      <FormMessage state={state} />
      <SubmitButton className="btn btn-primary btn-sm">{a.createBooking}</SubmitButton>
    </form>
  );
}

export function BookingEditDialog({ bookingId, code, courts, slot }: { bookingId: number; code: string; courts: CourtOption[]; slot: Slot }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, action] = useActionState(adminMoveBooking, null);
  const { t } = useI18n();
  const a = t.adminX;

  useEffect(() => {
    if (state?.ok) ref.current?.close();
  }, [state]);

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => ref.current?.showModal()}>
        {a.edit}
      </button>
      <dialog
        ref={ref}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-3xl border border-line bg-white p-0 text-ink backdrop:bg-court-950/50"
        onClick={(e) => e.target === ref.current && ref.current?.close()}
      >
        <form action={action} className="space-y-4 p-6 text-left">
          <input type="hidden" name="bookingId" value={bookingId} />
          <h2 className="text-xl font-bold">{a.editBookingTitle(code)}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <SlotFields courts={courts} uid={String(bookingId)} slot={slot} />
          </div>
          <FormMessage state={state?.error ? state : null} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => ref.current?.close()}>
              {t.common.close}
            </button>
            <SubmitButton>{a.saveChanges}</SubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}

export function RestoreBookingButton({ bookingId }: { bookingId: number }) {
  const [state, action] = useActionState(adminRestoreBooking, null);
  const { t } = useI18n();
  return (
    <form action={action} className="inline-flex flex-col items-end">
      <input type="hidden" name="bookingId" value={bookingId} />
      <SubmitButton className="btn btn-ghost btn-sm" pendingText="…">{t.adminX.restore}</SubmitButton>
      {state?.error && <p role="alert" className="mt-1 max-w-48 text-right text-xs text-clay-700">{state.error}</p>}
    </form>
  );
}
