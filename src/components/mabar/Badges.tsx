import type { Dict } from "@/lib/i18n";
import type { MMSession, SessionStatus } from "@/lib/mabar";

export function StatusBadge({ status, t }: { status: SessionStatus; t: Dict }) {
  const m = t.mabar;
  if (status === "done") return <span className="badge bg-sand text-muted">{m.stDone}</span>;
  if (status === "running") return <span className="badge bg-ball text-court-950">● {m.stRunning}</span>;
  return <span className="badge bg-court-100 text-court-800">{m.stDraft}</span>;
}

export function SessionChips({ session: s, t, compact = false, light = false }: { session: MMSession; t: Dict; compact?: boolean; light?: boolean }) {
  const m = t.mabar;
  const chips = [
    s.mode === "tournament" ? m.modeTournament : m.modeCasual,
    s.format === "doubles" ? m.fmtDoubles : m.fmtSingles,
    s.gender_rule === "mixed" ? m.ruleMixed : s.gender_rule === "same" ? m.ruleSame : m.ruleAny,
    m.sumTarget(s.target_score),
    ...(compact
      ? []
      : [
          m.sumDuration(s.duration_minutes),
          m.sumCourts(s.courts_count),
          m.sumMatch(s.match_minutes),
          ...(s.mode === "casual" && s.target_plays > 0 ? [m.sumPlays(s.target_plays)] : []),
        ]),
  ];
  return (
    <ul className="flex flex-wrap gap-1.5">
      {chips.map((c, i) => (
        <li key={c} className={`badge ${i === 0 ? (light ? "bg-ball text-court-950" : "bg-court-900 text-cream") : light ? "bg-cream/10 text-cream" : "bg-cream text-ink"}`}>
          {c}
        </li>
      ))}
    </ul>
  );
}
