import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "@/components/ResetForms";
import { getI18n } from "@/lib/i18n-server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.reset.metaTitle };
}

export default async function ForgotPasswordPage() {
  const { t } = await getI18n();
  return (
    <div className="container-page flex justify-center pt-14">
      <div className="w-full max-w-md">
        <p className="eyebrow">{t.reset.eyebrow}</p>
        <h1 className="mt-2 text-4xl font-bold">{t.reset.title}</h1>
        <p className="mt-3 text-muted">{t.reset.lead}</p>
        <div className="card mt-8 p-6">
          <ForgotForm />
        </div>
        <Link href="/masuk" className="mt-4 inline-block text-sm font-medium text-court-700 hover:underline">
          {t.reset.backToLogin}
        </Link>
      </div>
    </div>
  );
}
