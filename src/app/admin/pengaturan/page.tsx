import type { Metadata } from "next";
import { SettingsForm } from "@/components/admin/AdminForms";
import { getI18n } from "@/lib/i18n-server";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.adminX.tabSettings };
}

export default async function AdminSettings() {
  const { t } = await getI18n();
  return (
    <div className="max-w-3xl">
      <p className="eyebrow">{t.adminX.tabSettings}</p>
      <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{t.adminX.settingsTitle}</h1>
      <div className="mt-6">
        <SettingsForm settings={await getSettings()} />
      </div>
    </div>
  );
}
