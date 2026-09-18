"use client";

import { useActionState, useEffect, useRef } from "react";
import { deleteUser } from "@/app/actions/admin";
import { useI18n } from "../I18nProvider";
import { FormMessage, SubmitButton } from "../ui";

export function DeleteUserDialog({ userId, name, bookings }: { userId: number; name: string; bookings: number }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, action] = useActionState(deleteUser, null);
  const { t } = useI18n();
  const u = t.admin.users;

  useEffect(() => {
    if (state?.ok) ref.current?.close();
  }, [state]);

  return (
    <>
      <button className="btn btn-ghost btn-sm text-clay-700 hover:border-clay-600 hover:text-clay-700" onClick={() => ref.current?.showModal()}>
        {u.delete}
      </button>
      <dialog
        ref={ref}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-3xl border border-line bg-white p-0 text-ink backdrop:bg-court-950/50"
        onClick={(e) => e.target === ref.current && ref.current?.close()}
      >
        <form action={action} className="space-y-4 p-6 text-left">
          <input type="hidden" name="userId" value={userId} />
          <h2 className="text-xl font-bold">{u.deleteTitle(name)}</h2>
          <p className="rounded-xl bg-clay-50 px-3.5 py-2.5 text-sm text-clay-700">{u.deleteWarning(bookings)}</p>
          <FormMessage state={state?.error ? state : null} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => ref.current?.close()}>
              {t.common.close}
            </button>
            <SubmitButton className="btn btn-danger" pendingText={u.deleting}>
              {u.deleteConfirm}
            </SubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}
