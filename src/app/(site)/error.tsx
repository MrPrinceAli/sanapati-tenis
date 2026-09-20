"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useI18n } from "@/components/I18nProvider";

/**
 * Batas error untuk semua halaman publik. Layout (site) tetap dirender, jadi pengunjung
 * masih melihat navigasi dan footer — bukan halaman error mentah bawaan Next.
 */
export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error("[halaman]", error);
  }, [error]);
  return (
    <div className="container-page flex flex-col items-center py-24 text-center">
      <p className="font-display text-7xl font-bold text-court-900">Net!</p>
      <h1 className="mt-3 text-2xl font-semibold">{t.errorPage.title}</h1>
      <p className="mt-2 max-w-md text-muted">{t.errorPage.body}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="btn btn-primary">
          {t.errorPage.retry}
        </button>
        <Link href="/" className="btn btn-ghost">
          {t.errorPage.home}
        </Link>
      </div>
      {/* digest = penanda yang sama muncul di log server, jadi berguna saat pengunjung melaporkan masalah. */}
      {error.digest && (
        <details className="mt-10 text-xs text-muted">
          <summary className="cursor-pointer">{t.errorPage.detail}</summary>
          <code className="mt-2 block select-all">{error.digest}</code>
        </details>
      )}
    </div>
  );
}
