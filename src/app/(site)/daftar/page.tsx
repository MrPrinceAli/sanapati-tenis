import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/AuthForms";
import { getCurrentUser, safeNext } from "@/lib/auth";
import { getI18n } from "@/lib/i18n-server";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.auth.regMeta };
}

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect(safeNext(next, "/booking"));
  const { t } = await getI18n();
  return (
    <div className="container-page flex justify-center pt-14">
      <div className="w-full max-w-lg">
        <p className="eyebrow">{t.auth.regEyebrow}</p>
        <h1 className="mt-2 text-4xl font-bold">{t.auth.regTitle}</h1>
        {getSettings().registrationOpen ? (
          <div className="card mt-8 p-6">
            <RegisterForm next={next ? safeNext(next, "") : ""} />
          </div>
        ) : (
          <div className="card mt-8 p-6">
            <h2 className="text-xl font-semibold">{t.adminX.registrationClosedTitle}</h2>
            <p className="mt-2 text-sm text-muted">{t.adminX.registrationClosedBody}</p>
          </div>
        )}
      </div>
    </div>
  );
}
