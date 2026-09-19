import type { Metadata } from "next";
import Link from "next/link";
import { SessionChips, StatusBadge } from "@/components/mabar/Badges";
import { getCurrentUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n-server";
import { listSessions, type SessionCard } from "@/lib/mabar";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.mabar.metaTitle };
}

export default async function MabarPage() {
  const { t, f } = await getI18n();
  const m = t.mabar;
  const user = await getCurrentUser();
  const cards = await listSessions();
  const live = cards.filter((c) => c.status !== "done").reverse();
  const done = cards.filter((c) => c.status === "done");

  const Card = ({ card }: { card: SessionCard }) => {
    const { session: s } = card;
    const pct = card.total ? Math.round((card.done / card.total) * 100) : 0;
    return (
      <li>
        <Link href={`/mabar/${s.id}`} className="card flex h-full flex-col p-5 transition hover:-translate-y-0.5 hover:border-court-700">
          <div className="flex items-start justify-between gap-3">
            <StatusBadge status={card.status} t={t} />
            <span className="text-xs text-muted">{f.dateShort(s.play_date)}</span>
          </div>
          <h3 className="mt-3 text-xl font-semibold">{s.title}</h3>
          <p className="text-xs text-muted">
            {s.location ? `${s.location} · ` : ""}
            {m.by(card.ownerName)}
          </p>
          <div className="mt-3">
            <SessionChips session={s} t={t} compact />
          </div>
          <div className="mt-auto pt-5">
            {card.headline.length > 0 && (
              <p className="mb-2 text-sm">
                <span className="text-muted">{s.mode === "tournament" ? m.champion : m.leader}: </span>
                <span className="font-semibold">{card.headline.join(" & ")}</span>
              </p>
            )}
            <div className="flex items-center justify-between text-xs text-muted">
              <span>{m.players(card.playerCount)}</span>
              <span className="tabular-nums">{card.total ? m.progress(card.done, card.total) : ""}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sand" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={m.progress(card.done, card.total)}>
              <div className="h-full rounded-full bg-court-700" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </Link>
      </li>
    );
  };

  return (
    <div className="container-page pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{m.eyebrow}</p>
          <h1 className="mt-2 text-4xl font-bold sm:text-5xl">{m.title}</h1>
          <p className="mt-3 max-w-xl text-muted">{m.lead}</p>
        </div>
        <Link href={user ? "/mabar/baru" : `/masuk?next=${encodeURIComponent("/mabar/baru")}`} className="btn btn-primary">
          {user ? m.create : m.loginToCreate}
        </Link>
      </div>

      {cards.length === 0 ? (
        <div className="card mt-10 p-10 text-center text-muted">{m.empty}</div>
      ) : (
        <>
          {live.length > 0 && (
            <section className="mt-10">
              <h2 className="text-2xl font-semibold">{m.sectionLive}</h2>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {live.map((card) => (
                  <Card key={card.session.id} card={card} />
                ))}
              </ul>
            </section>
          )}
          {done.length > 0 && (
            <section className="mt-12">
              <h2 className="text-2xl font-semibold">{m.sectionDone}</h2>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {done.map((card) => (
                  <Card key={card.session.id} card={card} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
