import { NavBar } from "@/components/NavBar";
import { SiteFooter } from "@/components/SiteFooter";
import { getCurrentUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n-server";
import { getSettings } from "@/lib/settings";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  // Ketiganya saling bebas; dijalankan bersamaan supaya cold start tidak menumpuk tiga perjalanan ke database.
  const [user, { locale }, settings] = await Promise.all([getCurrentUser(), getI18n(), getSettings()]);
  const announcement = (locale === "en" && settings.announcementEn) || settings.announcementId;
  return (
    <>
      <NavBar user={user ? { id: user.id, name: user.name, hue: user.avatar_hue, avatar: user.avatar, isAdmin: user.role === "admin" } : null} />
      {announcement && (
        <p role="status" className="bg-ball px-4 py-2.5 text-center text-sm font-medium text-court-950">
          {announcement}
        </p>
      )}
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}
