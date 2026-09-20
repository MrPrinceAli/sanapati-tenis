import type { Metadata } from "next";
import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { AdminNav } from "@/components/admin/AdminNav";
import { LanguageSwitch } from "@/components/I18nProvider";
import { Logo } from "@/components/NavBar";
import { requireAdmin } from "@/lib/auth";
import { countPending } from "@/lib/gallery";
import { getI18n } from "@/lib/i18n-server";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin Sanapati" }, robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const [{ t }, pendingPhotos] = await Promise.all([getI18n(), countPending()]);
  return (
    <>
      <header className="bg-court-950 text-cream">
        <div className="container-page">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Logo light />
              <span className="badge bg-ball text-court-950">{t.admin.badge}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="hidden text-cream/60 sm:inline">{admin.name}</span>
              <LanguageSwitch light />
              <Link href="/" className="btn btn-sm border border-cream/20 text-cream hover:bg-cream/10">
                {t.admin.viewSite}
              </Link>
              <form action={logout}>
                <button className="btn btn-sm text-cream/70 hover:text-cream">{t.nav.logout}</button>
              </form>
            </div>
          </div>
          <AdminNav pendingPhotos={pendingPhotos} />
        </div>
      </header>
      <main className="container-page flex-1 pb-20 pt-8">{children}</main>
    </>
  );
}
