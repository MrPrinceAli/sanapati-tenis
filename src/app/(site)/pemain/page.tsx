import type { Metadata } from "next";
import Link from "next/link";
import { Avatar, LevelBadge } from "@/components/Avatar";
import { db } from "@/lib/db";
import { opt } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n-server";
import { LEVELS } from "@/lib/options";
import { todayWIB } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.players.metaTitle };
}

type PlayerRow = {
  id: number;
  name: string;
  level: string;
  city: string;
  hand: string;
  avatar_hue: number;
  avatar: string;
  hours: number;
};

export default async function PlayersPage({ searchParams }: { searchParams: Promise<{ level?: string }> }) {
  const { level } = await searchParams;
  const { t } = await getI18n();
  const activeLevel = LEVELS.includes(level ?? "") ? level! : "";

  const players = db
    .prepare(
      `SELECT u.id, u.name, u.level, u.city, u.hand, u.avatar_hue, u.avatar,
              COALESCE(SUM(CASE WHEN b.status = 'confirmed' AND b.kind = 'booking' AND b.date < @today
                                THEN b.end_hour - b.start_hour END), 0) AS hours
       FROM users u LEFT JOIN bookings b ON b.user_id = u.id
       WHERE u.is_public = 1 AND u.role = 'user' AND (@level = '' OR u.level = @level)
       GROUP BY u.id ORDER BY hours DESC, u.name`
    )
    .all({ today: todayWIB(), level: activeLevel }) as PlayerRow[];

  return (
    <div className="container-page pt-10">
      <p className="eyebrow">{t.players.eyebrow}</p>
      <h1 className="mt-2 text-4xl font-bold sm:text-5xl">{t.players.title}</h1>
      <p className="mt-3 max-w-xl text-muted">{t.players.lead}</p>

      <div className="mt-8 flex flex-wrap items-center gap-2">
        {["", ...LEVELS].map((l) => (
          <Link
            key={l || "all"}
            href={l ? `/pemain?level=${encodeURIComponent(l)}` : "/pemain"}
            className={`btn btn-sm ${activeLevel === l ? "btn-primary" : "btn-ghost"}`}
          >
            {l ? opt(t, l) : t.players.allLevels}
          </Link>
        ))}
      </div>

      {players.length === 0 ? (
        <p className="mt-10 text-muted">{t.players.none}</p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {players.map((p) => (
            <li key={p.id}>
              <Link href={`/pemain/${p.id}`} className="card flex items-center gap-4 p-5 transition hover:-translate-y-0.5 hover:border-court-700">
                <Avatar name={p.name} hue={p.avatar_hue} avatar={p.avatar} size={56} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg font-semibold">{p.name}</p>
                  <p className="truncate text-sm text-muted">
                    {p.city || "—"} · {p.hand === "Kiri" ? t.players.leftHanded : t.players.rightHanded}
                  </p>
                  <div className="mt-2">
                    <LevelBadge level={p.level} label={opt(t, p.level)} />
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-display text-xl font-bold tabular-nums">{p.hours}</p>
                  <p className="text-[11px] text-muted">{t.players.hoursPlayed}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
