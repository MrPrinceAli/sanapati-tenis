import type { Metadata } from "next";
import Link from "next/link";
import { AccountForm, AvatarForm, PasswordForm, ProfileForm } from "@/components/AccountForms";
import { requireUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n-server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.account.metaTitle };
}

export default async function AccountPage() {
  const user = await requireUser("/akun");
  const { t } = await getI18n();
  return (
    <div className="container-page max-w-3xl pt-10">
      <p className="eyebrow">{t.account.eyebrow}</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-4xl font-bold sm:text-5xl">{t.account.title}</h1>
        <Link href={`/pemain/${user.id}`} className="btn btn-ghost btn-sm">
          {t.account.viewPublic}
        </Link>
      </div>

      <section className="card mt-8 p-6">
        <h2 className="text-xl font-semibold">{t.account.sectionAccount}</h2>
        <div className="mt-5">
          <AccountForm data={{ name: user.name, email: user.email, phone: user.phone, reminder_minutes: user.reminder_minutes }} />
        </div>
      </section>

      <section id="profil" className="card mt-6 scroll-mt-24 p-6">
        <h2 className="text-xl font-semibold">{t.account.sectionProfile}</h2>
        <div className="mt-5 border-b border-line pb-5">
          <AvatarForm name={user.name} hue={user.avatar_hue} avatar={user.avatar} />
        </div>
        <div className="mt-5">
          <ProfileForm
            data={{
              name: user.name,
              level: user.level,
              hand: user.hand,
              backhand: user.backhand,
              city: user.city,
              bio: user.bio,
              avatar_hue: user.avatar_hue,
              avatar: user.avatar,
              is_public: !!user.is_public,
            }}
          />
        </div>
      </section>

      <section className="card mt-6 p-6">
        <h2 className="text-xl font-semibold">{t.account.sectionSecurity}</h2>
        <div className="mt-5">
          <PasswordForm />
        </div>
      </section>
    </div>
  );
}
