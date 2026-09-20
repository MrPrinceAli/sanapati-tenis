"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useI18n } from "@/components/I18nProvider";

/** Batas error khusus panel admin, supaya satu query yang gagal tidak mematikan seluruh dasbor. */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error("[admin]", error);
  }, [error]);
  return (
    <div className="card p-8 text-center">
      <h1 className="text-xl font-semibold">{t.errorPage.title}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{t.errorPage.bodyAdmin}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="btn btn-primary btn-sm">
          {t.errorPage.retry}
        </button>
        <Link href="/admin" className="btn btn-ghost btn-sm">
          {t.admin.tabs.overview}
        </Link>
      </div>
      {error.digest && (
        <details className="mt-8 text-xs text-muted">
          <summary className="cursor-pointer">{t.errorPage.detail}</summary>
          <code className="mt-2 block select-all">{error.digest}</code>
        </details>
      )}
    </div>
  );
}
