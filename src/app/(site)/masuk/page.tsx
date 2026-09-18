import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/AuthForms";
import { getCurrentUser, safeNext } from "@/lib/auth";
import { getI18n } from "@/lib/i18n-server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.auth.loginMeta };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const { next, reset } = await searchParams;
  if (await getCurrentUser()) redirect(safeNext(next));
  const { t } = await getI18n();
  return (
    <div className="container-page flex justify-center pt-14">
      <div className="w-full max-w-md">
        <p className="eyebrow">{t.auth.loginEyebrow}</p>
        <h1 className="mt-2 text-4xl font-bold">{t.auth.loginTitle}</h1>
        {reset && (
          <p role="status" className="mt-6 rounded-xl bg-court-50 px-3.5 py-2.5 text-sm text-court-800">
            {t.reset.done}
          </p>
        )}
        <div className="card mt-8 p-6">
          <LoginForm next={next ? safeNext(next, "") : ""} />
        </div>
        <p className="mt-4 text-center text-sm">
          <Link href="/lupa-password" className="font-medium text-court-700 hover:underline">
            {t.reset.forgot}
          </Link>
        </p>
        {process.env.NODE_ENV !== "production" && (
          <p className="mt-4 rounded-xl bg-sand px-4 py-3 text-xs leading-relaxed text-muted">
            <strong className="text-ink">{t.auth.demo}</strong> — {t.auth.demoPlayer}: raka@contoh.id / tenis123 · admin: admin@sanapati.id / admin123
          </p>
        )}
      </div>
    </div>
  );
}
