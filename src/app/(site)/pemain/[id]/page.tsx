import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, LevelBadge } from "@/components/Avatar";
import { getCurrentUser } from "@/lib/auth";
import { getPlayerStats } from "@/lib/bookings";
import { db, type User } from "@/lib/db";
import { opt } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n-server";
import { todayWIB } from "@/lib/time";

export const dynamic = "force-dynamic";

function loadPlayer(id: string): User | undefined {
  if (!/^[0-9]+$/.test(id)) return undefined;
  return db.prepare("SELECT * FROM users WHERE id = ?").get(Number(id)) as User | undefined;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const player = loadPlayer((await params).id);
  return { title: player?.is_public ? player.name : (await getI18n()).t.players.profileMeta };
}

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const player = loadPlayer((await params).id);
  const me = await getCurrentUser();
  const isMe = !!player && me?.id === player.id;
  // Profil privat hanya bisa dilihat pemiliknya.
  if (!player || (!player.is_public && !isMe)) notFound();

  const { t, f } = await getI18n();
  const stats = getPlayerStats(player.id);
  const recent = db
    .prepare(
      `SELECT b.date, b.start_hour, b.end_hour, c.name AS court_name FROM bookings b
       JOIN courts c ON c.id = b.court_id
       WHERE b.user_id = ? AND b.kind = 'booking' AND b.status = 'confirmed' AND b.date < ?
       ORDER BY b.date DESC, b.start_hour DESC LIMIT 5`
    )
    .all(player.id, todayWIB()) as { date: string; start_hour: number; end_hour: number; court_name: string }[];

  return (
    <div className="container-page max-w-4xl pt-10">
      <Link href="/pemain" className="text-sm font-medium text-court-700 hover:underline">
        {t.players.back}
      </Link>

      <header className="relative mt-4 overflow-hidden rounded-3xl bg-court-900 p-6 text-cream sm:p-10">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border-[3px] border-cream/10" />
        <div className="relative flex flex-wrap items-center gap-5">
          <Avatar name={player.name} hue={player.avatar_hue} avatar={player.avatar} size={96} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <LevelBadge level={player.level} label={opt(t, player.level)} />
              {!player.is_public && <span className="badge bg-cream/15 text-cream">{t.players.private}</span>}
            </div>
            <h1 className="mt-2 text-4xl font-bold sm:text-5xl">{player.name}</h1>
            <p className="mt-1 text-sm text-cream/70">
              {player.city ? `${player.city} · ` : ""}
              {t.players.joined(f.monthYear(player.created_at))}
            </p>
          </div>
          {isMe && (
            <Link href="/akun#profil" className="btn btn-ball btn-sm">
              {t.players.edit}
            </Link>
          )}
        </div>
      </header>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [String(stats.sessions), t.players.statSessions],
          [t.common.hours(stats.hours), t.players.statHours],
          [stats.favoriteCourt ?? "—", t.players.statFavorite],
          [stats.lastPlayed ? f.dateShort(stats.lastPlayed) : "—", t.players.statLast],
        ].map(([value, label]) => (
          <div key={label} className="card p-5">
            <dd className="font-display text-2xl font-bold">{value}</dd>
            <dt className="mt-1 text-xs text-muted">{label}</dt>
          </div>
        ))}
      </dl>

      <div className="mt-4 grid gap-4 md:grid-cols-[1.3fr_1fr]">
        <section className="card p-6">
          <h2 className="text-xl font-semibold">{t.players.about}</h2>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">
            {player.bio || (isMe ? t.players.noBioMe : t.players.noBio)}
          </p>
          <h3 className="mt-6 text-sm font-semibold">{t.players.style}</h3>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-cream p-3">
              <dt className="text-xs text-muted">{t.players.hand}</dt>
              <dd className="font-medium">{opt(t, player.hand)}</dd>
            </div>
            <div className="rounded-xl bg-cream p-3">
              <dt className="text-xs text-muted">{t.players.backhand}</dt>
              <dd className="font-medium">{opt(t, player.backhand)}</dd>
            </div>
          </dl>
        </section>

        <section className="card p-6">
          <h2 className="text-xl font-semibold">{t.players.recent}</h2>
          {recent.length === 0 ? (
            <p className="mt-3 text-sm text-muted">{t.players.noRecent}</p>
          ) : (
            <ul className="mt-3 divide-y divide-line text-sm">
              {recent.map((r, i) => (
                <li key={i} className="flex justify-between gap-3 py-2.5">
                  <span className="font-medium">{r.court_name}</span>
                  <span className="shrink-0 text-muted">
                    {f.dateShort(r.date)} · {f.range(r.start_hour, r.end_hour)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
