"use client";

import { useFormStatus } from "react-dom";
import type { FormState } from "@/lib/form";
import { useI18n } from "./I18nProvider";

export function SubmitButton({
  children,
  className = "btn btn-primary",
  pendingText,
}: {
  children: React.ReactNode;
  className?: string;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  const { t } = useI18n();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? (pendingText ?? t.common.processing) : children}
    </button>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (!state?.error && !state?.ok) return null;
  return (
    <p
      role={state.error ? "alert" : "status"}
      className={`rounded-xl px-3.5 py-2.5 text-sm ${
        state.error ? "bg-clay-50 text-clay-700" : "bg-court-50 text-court-800"
      }`}
    >
      {state.error ?? state.ok}
    </p>
  );
}
