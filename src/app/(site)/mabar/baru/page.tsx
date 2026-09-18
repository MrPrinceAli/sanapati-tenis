import type { Metadata } from "next";
import Link from "next/link";
import { SessionForm } from "@/components/mabar/SessionForm";
import { requireUser } from "@/lib/auth";
import { getCourts } from "@/lib/bookings";
import { getI18n } from "@/lib/i18n-server";
import { todayWIB } from "@/lib/time";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.mabar.create };
}

export default async function NewSessionPage() {
  await requireUser("/mabar/baru");
  const { t } = await getI18n();
  const locations = getCourts().map((c) => c.name);
  return (
    <div className="container-page max-w-3xl pt-10">
      <Link href="/mabar" className="text-sm font-medium text-court-700 hover:underline">
        {t.mabar.back}
      </Link>
      <h1 className="mt-4 text-4xl font-bold sm:text-5xl">{t.mabar.formNew}</h1>
      <div className="card mt-8 p-6">
        <SessionForm
          locations={locations}
          initial={{
            title: "",
            play_date: todayWIB(),
            location: locations[0] ?? "",
            mode: "casual",
            format: "doubles",
            gender_rule: "any",
            target_score: 6,
            duration_minutes: 120,
            match_minutes: 20,
            courts_count: 1,
            target_plays: 0,
            open_edit: 1,
          }}
        />
      </div>
    </div>
  );
}
