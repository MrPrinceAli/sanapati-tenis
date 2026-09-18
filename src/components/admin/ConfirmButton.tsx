"use client";

import { useRef } from "react";
import { useI18n } from "../I18nProvider";

/** Tombol untuk aksi yang tidak bisa diurungkan: selalu lewat dialog konfirmasi dulu. */
export function ConfirmButton({
  action,
  fields,
  label,
  message,
  confirmLabel,
  className = "btn btn-ghost btn-sm text-clay-700 hover:border-clay-600 hover:text-clay-700",
}: {
  action: (form: FormData) => void | Promise<void>;
  fields: Record<string, string | number>;
  label: string;
  message: string;
  confirmLabel: string;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useI18n();
  return (
    <>
      <button type="button" className={className} onClick={() => ref.current?.showModal()}>
        {label}
      </button>
      <dialog
        ref={ref}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-3xl border border-line bg-white p-6 text-left text-ink backdrop:bg-court-950/50"
        onClick={(e) => e.target === ref.current && ref.current?.close()}
      >
        <p className="rounded-xl bg-clay-50 px-3.5 py-2.5 text-sm text-clay-700">{message}</p>
        <form action={action} onSubmit={() => ref.current?.close()} className="mt-5 flex justify-end gap-2">
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <button type="button" className="btn btn-ghost" onClick={() => ref.current?.close()}>
            {t.common.close}
          </button>
          <button className="btn btn-danger">{confirmLabel}</button>
        </form>
      </dialog>
    </>
  );
}
