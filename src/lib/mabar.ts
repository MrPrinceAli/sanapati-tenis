import "server-only";
import { db, type User } from "./db";
import { standings, type Format, type Gender, type GenderRule, type Sides, type Standing } from "./matchmaking";

export type MMSession = {
  id: number;
  owner_id: number;
  title: string;
  play_date: string;
  location: string;
  mode: "casual" | "tournament";
  format: Format;
  gender_rule: GenderRule;
  target_score: number;
  duration_minutes: number;
  match_minutes: number;
  courts_count: number;
  target_plays: number;
  finished: number;
  /** 1 = siapa pun (tanpa login) boleh mengisi skor dan nama pemain. */
  open_edit: number;
  created_at: string;
};
export type MMPlayerRow = { id: number; session_id: number; name: string; gender: Gender; active: number };
export type MMMatch = {
  id: number;
  session_id: number;
  round: number;
  slot: number;
  a1: number | null;
  a2: number | null;
  b1: number | null;
  b2: number | null;
  score_a: number | null;
  score_b: number | null;
  is_bye: number;
};
export type SessionStatus = "draft" | "running" | "done";

export const LIMITS = {
  players: 64,
  target: [1, 99],
  duration: [15, 600],
  matchMinutes: [5, 120],
  courts: [1, 8],
  plays: [0, 20],
} as const;

export const sidesOf = (m: MMMatch): Sides => ({
  a: [m.a1, m.a2].filter((x): x is number => x !== null),
  b: [m.b1, m.b2].filter((x): x is number => x !== null),
});
export const isScored = (m: MMMatch) => m.score_a !== null && m.score_b !== null;
/** Pertandingan yang benar-benar dimainkan (bukan bye, bukan slot bagan yang masih kosong). */
export const isPlayable = (m: MMMatch) => !m.is_bye && m.a1 !== null && m.b1 !== null;

export function statusOf(session: MMSession, matches: MMMatch[]): SessionStatus {
  const real = matches.filter((m) => !m.is_bye);
  if (real.length === 0) return "draft";
  return session.finished || real.every(isScored) ? "done" : "running";
}

export const canManage = (session: MMSession, user: User | null) =>
  !!user && (user.id === session.owner_id || user.role === "admin");

/** Skor & nama pemain: pengelola selalu boleh; publik hanya selama sesi terbuka dan belum ditandai selesai. */
export const canContribute = (session: MMSession, user: User | null) =>
  canManage(session, user) || (!!session.open_edit && !session.finished);

export async function getSession(id: number): Promise<MMSession | undefined> {
  if (!Number.isInteger(id)) return undefined;
  return db.get<MMSession>("SELECT * FROM mm_sessions WHERE id = ?", id);
}
export const getPlayers = (sessionId: number) => db.all<MMPlayerRow>("SELECT * FROM mm_players WHERE session_id = ? ORDER BY id", sessionId);
export const getMatches = (sessionId: number) =>
  db.all<MMMatch>("SELECT * FROM mm_matches WHERE session_id = ? ORDER BY round, slot", sessionId);

export function standingsFor(players: MMPlayerRow[], matches: MMMatch[]): Standing[] {
  return standings(
    players.map((p) => p.id),
    matches.filter((m) => isScored(m) && isPlayable(m)).map((m) => ({ sides: sidesOf(m), scoreA: m.score_a!, scoreB: m.score_b! }))
  );
}

/** Juara turnamen = pemenang pertandingan di babak terakhir. */
export function championOf(matches: MMMatch[]): number[] | null {
  if (matches.length === 0) return null;
  const lastRound = Math.max(...matches.map((m) => m.round));
  const final = matches.find((m) => m.round === lastRound);
  if (!final || !isScored(final) || final.score_a === final.score_b) return null;
  const s = sidesOf(final);
  return final.score_a! > final.score_b! ? s.a : s.b;
}

export type SessionCard = {
  session: MMSession;
  ownerName: string;
  playerCount: number;
  total: number;
  done: number;
  status: SessionStatus;
  /** Nama pemimpin klasemen (mabar) atau juara (turnamen). */
  headline: string[];
};

export async function listSessions(limit = 60): Promise<SessionCard[]> {
  const sessions = await db.all<MMSession & { owner_name: string }>(
    `SELECT s.*, u.name AS owner_name FROM mm_sessions s JOIN users u ON u.id = s.owner_id
     ORDER BY s.play_date DESC, s.id DESC LIMIT ?`,
    limit
  );
  if (sessions.length === 0) return [];

  // Pemain & pertandingan semua sesi diambil dalam dua query (bukan dua query per sesi):
  // dengan database di cloud, jumlah round-trip jauh lebih menentukan kecepatan daripada ukuran hasilnya.
  const ids = sessions.map((x) => x.id);
  const marks = ids.map(() => "?").join(",");
  const [allPlayers, allMatches] = await Promise.all([
    db.all<MMPlayerRow>(`SELECT * FROM mm_players WHERE session_id IN (${marks}) ORDER BY id`, ...ids),
    db.all<MMMatch>(`SELECT * FROM mm_matches WHERE session_id IN (${marks}) ORDER BY round, slot`, ...ids),
  ]);

  return sessions.map((session) => {
    const players = allPlayers.filter((p) => p.session_id === session.id);
    const matches = allMatches.filter((m) => m.session_id === session.id);
    const real = matches.filter((m) => !m.is_bye);
    const name = (id: number) => players.find((p) => p.id === id)?.name ?? "?";
    let headline: string[] = [];
    if (session.mode === "tournament") headline = (championOf(matches) ?? []).map(name);
    else {
      const top = standingsFor(players, matches)[0];
      if (top && top.played > 0) headline = [name(top.id)];
    }
    return {
      session,
      ownerName: session.owner_name,
      playerCount: players.filter((p) => p.active).length,
      total: real.length,
      done: real.filter(isScored).length,
      status: statusOf(session, matches),
      headline,
    };
  });
}
