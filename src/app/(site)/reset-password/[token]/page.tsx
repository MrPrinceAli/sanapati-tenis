import type { Metadata } from "next";
import Link from "next/link";
import { NewPasswordForm } from "@/components/ResetForms";
import { getI18n } from "@/lib/i18n-server";
import { findUserByResetToken } from "@/lib/password-reset";

export const dynamic = "force-dynamic";

// Token ada di URL: jangan sampai terindeks atau bocor lewat header Referer.
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.reset.metaTitle, robots: { index: false }, referrer: "no-referrer" };
}

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { t } = await getI18n();
  const user = findUserByResetToken(token);

  return (
    <div className="container-page flex justify-center pt-14">
      <div className="w-full max-w-md">
        <p className="eyebrow">{t.reset.eyebrow}</p>
        {user ? (
          <>
            <h1 className="mt-2 text-4xl font-bold">{t.reset.newTitle}</h1>
            <p className="mt-3 text-muted">{t.reset.newLead(user.email)}</p>
            <div className="card mt-8 p-6">
              <NewPasswordForm token={token} />
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-2 text-4xl font-bold">{t.reset.invalidTitle}</h1>
            <p className="mt-3 text-muted">{t.reset.invalidBody}</p>
            <Link href="/lupa-password" className="btn btn-primary mt-8">
              {t.reset.requestNew}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
