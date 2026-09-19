import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SessionChips, StatusBadge } from "@/components/mabar/Badges";
import { AddPlayerForm, AutoRefresh, ManageBar, PlayerChip, ScoreForm } from "@/components/mabar/Controls";
import { SessionForm } from "@/components/mabar/SessionForm";
import { getCurrentUser } from "@/lib/auth";
import { getCourts } from "@/lib/bookings";
import { db } from "@/lib/db";
import type { Dict } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n-server";
import {
  canContribute,
  canManage,
  championOf,
  getMatches,
  getPlayers,
  getSession,
  isPlayable,
  isScored,
  sidesOf,
  standingsFor,
  statusOf,
  type MMMatch,
} from "@/lib/mabar";
import { estimateMinutes, teamSize } from "@/lib/matchmaking";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const session = await getSession(Number((await params).id));
  return { title: session?.title ?? (await getI18n()).t.mabar.metaTitle };
}

function bracketRoundName(m: Dict["mabar"], matchesInRound: number) {
  if (matchesInRound === 1) return m.final;
  if (matchesInRound === 2) return m.semifinal;
  if (matchesInRound === 4) return m.quarterfinal;
  return m.roundOf(matchesInRound * 2);
}

export default async function SessionPage({ params }: Params) {
  const session = await getSession(Number((await params).id));
  if (!session) notFound();

  const { t, f } = await getI18n();
  const m = t.mabar;
  const user = await getCurrentUser();
  const manager = canManage(session, user);
  // Kontributor = boleh isi skor & nama. Di sesi terbuka itu berarti semua orang, termasuk yang tidak login.
  const contributor = canContribute(session, user);
  const players = await getPlayers(session.id);
  const active = players.filter((p) => p.active);
  const matches = await getMatches(session.id);
  const status = statusOf(session, matches);
  const owner = await db.get("SELECT name FROM users WHERE id = ?", session.owner_id) as { name: string } | undefined;

  const nameOf = (id: number) => players.find((p) => p.id === id)?.name ?? "?";
  const team = (ids: number[]) => ids.map(nameOf).join(" & ");
  const rounds = [...new Set(matches.map((x) => x.round))].sort((a, b) => a - b);
  const inRound = (r: number) => matches.filter((x) => x.round === r);

  // Ringkasan rencana + peringatan, hanya relevan bagi pengelola.
  const perRound = rounds.map((r) => inRound(r).filter((x) => !x.is_bye).length);
  const estimate = estimateMinutes(perRound, session.courts_count, session.match_minutes);
  const playCount = new Map<number, number>();
  for (const x of matches.filter(isPlayable)) for (const id of [...sidesOf(x).a, ...sidesOf(x).b]) playCount.set(id, (playCount.get(id) ?? 0) + 1);
  const minPlays = active.length ? Math.min(...active.map((p) => playCount.get(p.id) ?? 0)) : 0;
  const leftOut =
    session.mode === "tournament" && matches.length > 0
      ? active.filter((p) => !inRound(1).some((x) => [x.a1, x.a2, x.b1, x.b2].includes(p.id)))
      : [];
  const needed = teamSize(session.format) * 2;
  const champion = session.mode === "tournament" ? championOf(matches) : null;
  const table = session.mode === "casual" ? standingsFor(players, matches).filter((s) => s.played > 0 || players.find((p) => p.id === s.id)?.active) : [];

  const MatchRow = ({ x, label }: { x: MMMatch; label: string }) => {
    const s = sidesOf(x);
    const scored = isScored(x);
    const aWon = scored && x.score_a! > x.score_b!;
    const bWon = scored && x.score_b! > x.score_a!;
    const side = (ids: number[], won: boolean, lost: boolean) => (
      <span className={`min-w-0 flex-1 truncate ${won ? "font-semibold text-court-800" : lost ? "text-muted" : "font-medium"}`}>
        {ids.length ? team(ids) : <span className="font-normal italic text-muted">{m.tbd}</span>}
      </span>
    );
    return (
      <li className="rounded-xl border border-line bg-white p-3">
        <div className="flex items-center gap-3 text-sm">
          <span className="w-12 shrink-0 text-[11px] font-semibold uppercase text-muted">{label}</span>
          {side(s.a, aWon, bWon)}
          <span className="shrink-0 rounded-lg bg-cream px-2.5 py-1 font-display font-bold tabular-nums">
            {x.is_bye ? m.byeShort : scored ? `${x.score_a} – ${x.score_b}` : m.vs}
          </span>
          <span className="flex min-w-0 flex-1 justify-end text-right">{x.is_bye ? <span className="sr-only">{m.bye}</span> : side(s.b, bWon, aWon)}</span>
        </div>
        {contributor && isPlayable(x) && (
          <div className="mt-2 flex justify-end border-t border-line pt-2">
            <ScoreForm sessionId={session.id} matchId={x.id} scoreA={x.score_a} scoreB={x.score_b} labelA={team(s.a)} labelB={team(s.b)} max={session.target_score} />
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="container-page pt-10">
      {status === "running" && <AutoRefresh />}
      <Link href="/mabar" className="text-sm font-medium text-court-700 hover:underline">
        {m.back}
      </Link>

      <header className="relative mt-4 overflow-hidden rounded-3xl bg-court-900 p-6 text-cream sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border-[3px] border-cream/10" />
        <div className="relative">
          <StatusBadge status={status} t={t} />
          <h1 className="mt-3 text-3xl font-bold sm:text-5xl">{session.title}</h1>
          <p className="mt-2 text-sm text-cream/70">
            {f.dateLong(session.play_date)}
            {session.location ? ` · ${session.location}` : ""} · {m.by(owner?.name ?? "?")}
          </p>
          <div className="mt-4">
            <SessionChips session={session} t={t} light />
          </div>
          <p className="mt-4 flex items-start gap-2 text-xs text-cream/70">
            <span className={`badge shrink-0 ${contributor && !manager ? "bg-ball text-court-950" : "bg-cream/10 text-cream"}`}>
              {session.open_edit && !session.finished ? m.badgeOpen : m.badgeLocked}
            </span>
            <span className="pt-0.5">{session.open_edit && !session.finished ? m.openNote : m.lockedNote}</span>
          </p>
          {champion && <p className="mt-5 font-display text-2xl font-bold text-ball">{m.championIs(team(champion))}</p>}
        </div>
      </header>

      {manager && (
        <section className="card mt-4 space-y-4 p-5">
          <p className="text-xs text-muted">{m.managerNote}</p>
          {active.length < needed && <p className="rounded-xl bg-sand px-3.5 py-2.5 text-sm text-muted">{m.needPlayers(needed)}</p>}
          <ManageBar
            sessionId={session.id}
            mode={session.mode}
            hasMatches={matches.length > 0}
            finished={!!session.finished}
            canGenerate={active.length >= needed}
          />
          {matches.length > 0 && (
            <ul className="space-y-1.5 text-sm">
              <li className="text-muted">{m.planOk(rounds.length, estimate)}</li>
              {estimate > session.duration_minutes && <li className="rounded-xl bg-clay-50 px-3.5 py-2 text-clay-700">{m.planOver(estimate, session.duration_minutes)}</li>}
              {session.mode === "casual" && session.target_plays > 0 && minPlays < session.target_plays && (
                <li className="rounded-xl bg-clay-50 px-3.5 py-2 text-clay-700">{m.planShort(session.target_plays, minPlays)}</li>
              )}
              {leftOut.length > 0 && <li className="rounded-xl bg-clay-50 px-3.5 py-2 text-clay-700">{m.leftOut(leftOut.map((p) => p.name).join(", "))}</li>}
            </ul>
          )}
          <details className="border-t border-line pt-4">
            <summary className="cursor-pointer text-sm font-semibold text-court-700">{m.formEdit}</summary>
            <div className="mt-5">
              <SessionForm locations={(await getCourts()).map((c) => c.name)} initial={session} />
            </div>
          </details>
        </section>
      )}

      <div className={`mt-4 grid items-start gap-4 ${session.mode === "casual" ? "lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]" : ""}`}>
        <section className="min-w-0">
          <h2 className="text-2xl font-semibold">{session.mode === "tournament" ? m.bracket : m.schedule}</h2>
          {matches.length === 0 ? (
            <p className="card mt-4 p-8 text-center text-muted">{m.noSchedule}</p>
          ) : session.mode === "tournament" ? (
            <div className="mt-4 overflow-x-auto pb-2">
              <div className="flex gap-4" style={{ minWidth: `${rounds.length * 17}rem` }}>
                {rounds.map((r) => (
                  <div key={r} className="flex min-w-64 flex-1 flex-col">
                    <h3 className="mb-2 text-sm font-semibold text-clay-600">{bracketRoundName(m, inRound(r).length)}</h3>
                    <ul className="flex flex-1 flex-col justify-around gap-3">
                      {inRound(r).map((x) => (
                        <MatchRow key={x.id} x={x} label={`#${x.slot + 1}`} />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {rounds.map((r) => {
                const busy = new Set(inRound(r).flatMap((x) => [x.a1, x.a2, x.b1, x.b2]));
                // Yang istirahat dihitung dari peserta jadwal, supaya pemain yang ditambahkan belakangan tidak muncul di ronde lama.
                const resting = players.filter((p) => playCount.has(p.id) && !busy.has(p.id));
                return (
                  <div key={r} className="rounded-2xl bg-sand p-4">
                    <h3 className="font-display text-lg font-semibold">{m.round(r)}</h3>
                    <ul className="mt-3 space-y-2">
                      {inRound(r).map((x) => (
                        <MatchRow key={x.id} x={x} label={m.court(x.slot + 1)} />
                      ))}
                    </ul>
                    {resting.length > 0 && (
                      <p className="mt-3 text-xs text-muted">
                        {m.resting}: {resting.map((p) => p.name).join(", ")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div className={`space-y-4 ${session.mode === "casual" ? "lg:sticky lg:top-24" : "max-w-xl"}`}>
          {session.mode === "casual" && (
            <section className="card overflow-hidden">
              <div className="p-5 pb-3">
                <h2 className="text-xl font-semibold">{m.standings}</h2>
                <p className="mt-1 text-xs text-muted">{m.standingsHint}</p>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="border-y border-line bg-cream text-xs text-muted">
                  <tr>
                    <th className="py-2 pl-5 pr-2 font-medium">#</th>
                    <th className="px-2 py-2 font-medium">{m.colPlayer}</th>
                    {[m.colPlayed, m.colWon, m.colDrawn, m.colLost, m.colFor, m.colDiff].map((c, i) => (
                      <th key={c} className={`px-2 py-2 text-right font-medium ${i === 5 ? "pr-5" : ""}`}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line tabular-nums">
                  {table.map((row, i) => (
                    <tr key={row.id} className={i === 0 && row.played > 0 ? "bg-court-50" : ""}>
                      <td className="py-2 pl-5 pr-2 text-muted">{i + 1}</td>
                      <td className="max-w-32 truncate px-2 py-2 font-medium">{nameOf(row.id)}</td>
                      <td className="px-2 py-2 text-right">{row.played}</td>
                      <td className="px-2 py-2 text-right font-semibold">{row.won}</td>
                      <td className="px-2 py-2 text-right">{row.drawn}</td>
                      <td className="px-2 py-2 text-right">{row.lost}</td>
                      <td className="px-2 py-2 text-right">{row.pointsFor}</td>
                      <td className="py-2 pl-2 pr-5 text-right">{row.pointsFor - row.pointsAgainst > 0 ? "+" : ""}{row.pointsFor - row.pointsAgainst}</td>
                    </tr>
                  ))}
                  {table.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-5 py-6 text-center text-muted">{m.noPlayers}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          )}

          <section className="card p-5">
            <h2 className="text-xl font-semibold">{m.playersTitle(active.length)}</h2>
            {contributor && (
              <div className="mt-4">
                <AddPlayerForm sessionId={session.id} />
              </div>
            )}
            {players.length === 0 ? (
              <p className="mt-4 text-sm text-muted">{m.noPlayers}</p>
            ) : (
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {players.map((p) => (
                  <PlayerChip key={p.id} sessionId={session.id} player={p} canEdit={contributor} canRemove={manager} />
                ))}
              </ul>
            )}
          </section>
          {status === "running" && <p className="text-center text-xs text-muted">{m.autoRefresh}</p>}
        </div>
      </div>
    </div>
  );
}
