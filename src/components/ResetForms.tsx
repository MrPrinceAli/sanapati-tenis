"use client";

import { useActionState, useRef, useState } from "react";
import { createResetLink } from "@/app/actions/admin";
import { requestPasswordReset, resetPassword } from "@/app/actions/auth";
import { useI18n } from "./I18nProvider";
import { FormMessage, SubmitButton } from "./ui";

export function ForgotForm() {
  const [state, action] = useActionState(requestPasswordReset, null);
  const { t } = useI18n();
  if (state?.ok) {
    return (
      <div className="space-y-3">
        <FormMessage state={state} />
        <p className="text-sm text-muted">{t.reset.noEmailService}</p>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="email" className="label">{t.auth.email}</label>
        <input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.values?.email} className="input" />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn btn-primary w-full">{t.reset.send}</SubmitButton>
    </form>
  );
}

export function NewPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPassword, null);
  const { t } = useI18n();
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <label htmlFor="password" className="label">{t.reset.newPw}</label>
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className="input" />
        <p className="mt-1 text-xs text-muted">{t.auth.pwHint}</p>
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn btn-primary w-full">{t.reset.save}</SubmitButton>
    </form>
  );
}

// Admin: buat link reset untuk dikirim manual (mis. lewat WhatsApp) — jalan tanpa layanan email.
export function ResetLinkDialog({ userId, name }: { userId: number; name: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, action] = useActionState(createResetLink, null);
  const [copied, setCopied] = useState(false);
  const { t } = useI18n();
  const link = state?.values?.kind === "link" ? state.ok : undefined;

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => ref.current?.showModal()}>
        {t.reset.adminButton}
      </button>
      <dialog
        ref={ref}
        className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-3xl border border-line bg-white p-0 text-ink backdrop:bg-court-950/50"
        onClick={(e) => e.target === ref.current && ref.current?.close()}
      >
        <form action={action} className="space-y-4 p-6 text-left">
          <input type="hidden" name="userId" value={userId} />
          <h2 className="text-xl font-bold">{t.reset.adminTitle(name)}</h2>
          <p className="text-sm text-muted">{t.reset.adminLead}</p>
          {link && (
            <div className="flex gap-2">
              <input readOnly value={link} aria-label={t.reset.adminTitle(name)} className="input font-mono text-xs" onFocus={(e) => e.target.select()} />
              <button
                type="button"
                className="btn btn-ball btn-sm shrink-0"
                onClick={async () => {
                  await navigator.clipboard.writeText(link).catch(() => {});
                  setCopied(true);
                }}
              >
                {copied ? t.reset.copied : t.reset.copy}
              </button>
            </div>
          )}
          <FormMessage state={state?.error ? state : null} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => ref.current?.close()}>
              {t.common.close}
            </button>
            {!link && <SubmitButton>{t.reset.adminCreate}</SubmitButton>}
          </div>
        </form>
      </dialog>
    </>
  );
}
