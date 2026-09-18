// Mesin matchmaking: fungsi murni tanpa akses database, supaya mudah diuji.
// "Mabar" = rotasi adil ala Americano; "turnamen" = sistem gugur.

export type Gender = "M" | "F";
export type Format = "singles" | "doubles";
export type GenderRule = "any" | "same" | "mixed";
export type MMPlayer = { id: number; gender: Gender };
export type Sides = { a: number[]; b: number[] };
export type PlannedRound = { round: number; matches: Sides[]; resting: number[] };

export type PlanSettings = {
  format: Format;
  genderRule: GenderRule;
  courts: number;
  /** Jumlah ronde yang muat di durasi rencana. */
  maxRounds: number;
  /** 0 = isi seluruh durasi; N = berhenti begitu semua pemain sudah main N kali. */
  targetPlays: number;
};

export const teamSize = (format: Format) => (format === "doubles" ? 2 : 1);

// Mix (1 cowok + 1 cewek per tim) hanya bermakna untuk double.
export const effectiveRule = (format: Format, rule: GenderRule): GenderRule =>
  format === "singles" && rule === "mixed" ? "any" : rule;

function shuffle<T>(items: T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const key = (x: number, y: number) => (x < y ? `${x}-${y}` : `${y}-${x}`);

class History {
  plays = new Map<number, number>();
  lastRound = new Map<number, number>();
  partners = new Map<string, number>();
  opponents = new Map<string, number>();

  add(m: Sides, round: number) {
    for (const p of [...m.a, ...m.b]) {
      this.plays.set(p, (this.plays.get(p) ?? 0) + 1);
      this.lastRound.set(p, round);
    }
    for (const side of [m.a, m.b]) {
      if (side.length === 2) this.partners.set(key(side[0], side[1]), (this.partners.get(key(side[0], side[1])) ?? 0) + 1);
    }
    for (const x of m.a) for (const y of m.b) this.opponents.set(key(x, y), (this.opponents.get(key(x, y)) ?? 0) + 1);
  }

  // Makin kecil makin bagus: pasangan yang berulang lebih "mahal" daripada lawan yang berulang.
  cost(m: Sides): number {
    let c = 0;
    for (const side of [m.a, m.b]) if (side.length === 2) c += 4 * (this.partners.get(key(side[0], side[1])) ?? 0);
    for (const x of m.a) for (const y of m.b) c += this.opponents.get(key(x, y)) ?? 0;
    return c;
  }
}

function bestSplit(group: MMPlayer[], format: Format, rule: GenderRule, h: History): Sides {
  if (format === "singles") return { a: [group[0].id], b: [group[1].id] };
  let options: Sides[];
  if (rule === "mixed") {
    const men = group.filter((p) => p.gender === "M");
    const women = group.filter((p) => p.gender === "F");
    options = [
      { a: [men[0].id, women[0].id], b: [men[1].id, women[1].id] },
      { a: [men[0].id, women[1].id], b: [men[1].id, women[0].id] },
    ];
  } else {
    const [w, x, y, z] = group.map((p) => p.id);
    options = [
      { a: [w, x], b: [y, z] },
      { a: [w, y], b: [x, z] },
      { a: [w, z], b: [x, y] },
    ];
  }
  return options.reduce((best, o) => (h.cost(o) < h.cost(best) ? o : best));
}

// Ambil satu grup pemain untuk satu pertandingan dari antrean (sudah terurut: paling sedikit main dulu).
function takeGroup(queue: MMPlayer[], format: Format, rule: GenderRule): MMPlayer[] | null {
  const size = teamSize(format) * 2;
  if (rule === "any") return queue.length >= size ? queue.slice(0, size) : null;
  if (rule === "mixed") {
    const men = queue.filter((p) => p.gender === "M").slice(0, 2);
    const women = queue.filter((p) => p.gender === "F").slice(0, 2);
    return men.length === 2 && women.length === 2 ? [...men, ...women] : null;
  }
  // "same": mulai dari pemain yang paling berhak main; kalau gendernya tidak cukup orang, coba pemain berikutnya.
  for (const seed of queue) {
    const group = queue.filter((p) => p.gender === seed.gender).slice(0, size);
    if (group.length === size) return group;
  }
  return null;
}

export function planRounds(
  players: MMPlayer[],
  past: { round: number; sides: Sides }[],
  settings: PlanSettings,
  startRound: number,
  rand: () => number = Math.random
): PlannedRound[] {
  const rule = effectiveRule(settings.format, settings.genderRule);
  const h = new History();
  for (const m of past) h.add(m.sides, m.round);
  const plays = (p: MMPlayer) => h.plays.get(p.id) ?? 0;
  const rounds: PlannedRound[] = [];

  for (let round = startRound; round <= settings.maxRounds; round++) {
    if (settings.targetPlays > 0 && players.every((p) => plays(p) >= settings.targetPlays)) break;

    // Beberapa percobaan acak; ambil susunan ronde dengan pengulangan pasangan/lawan paling sedikit.
    let best: { matches: Sides[]; cost: number } | null = null;
    for (let attempt = 0; attempt < 120; attempt++) {
      let queue = shuffle(players, rand).sort(
        (x, y) => plays(x) - plays(y) || (h.lastRound.get(x.id) ?? 0) - (h.lastRound.get(y.id) ?? 0)
      );
      const matches: Sides[] = [];
      let cost = 0;
      while (matches.length < settings.courts) {
        const group = takeGroup(queue, settings.format, rule);
        if (!group) break;
        const sides = bestSplit(group, settings.format, rule, h);
        cost += h.cost(sides);
        // Keadilan jumlah main jauh lebih penting daripada variasi lawan.
        for (const p of group) cost += 50 * (plays(p) - plays(queue[0]));
        matches.push(sides);
        queue = queue.filter((p) => !group.includes(p));
      }
      // Lebih banyak lapangan terisi selalu menang.
      cost -= 10_000 * matches.length;
      if (!best || cost < best.cost) best = { matches, cost };
    }
    if (!best || best.matches.length === 0) break;

    const busy = new Set(best.matches.flatMap((m) => [...m.a, ...m.b]));
    for (const m of best.matches) h.add(m, round);
    rounds.push({ round, matches: best.matches, resting: players.filter((p) => !busy.has(p.id)).map((p) => p.id) });
  }
  return rounds;
}

/** Bentuk tim turnamen sesuai aturan gender. `left` = pemain yang tidak kebagian pasangan. */
export function formTeams(players: MMPlayer[], format: Format, genderRule: GenderRule, rand: () => number = Math.random) {
  const rule = effectiveRule(format, genderRule);
  const pool = shuffle(players, rand);
  if (format === "singles") return { teams: pool.map((p) => [p.id]), left: [] as number[] };

  const teams: number[][] = [];
  const left: number[] = [];
  const pairUp = (list: MMPlayer[]) => {
    for (let i = 0; i + 1 < list.length; i += 2) teams.push([list[i].id, list[i + 1].id]);
    if (list.length % 2) left.push(list[list.length - 1].id);
  };
  const men = pool.filter((p) => p.gender === "M");
  const women = pool.filter((p) => p.gender === "F");
  if (rule === "any") pairUp(pool);
  else if (rule === "same") {
    pairUp(men);
    pairUp(women);
  } else {
    const n = Math.min(men.length, women.length);
    for (let i = 0; i < n; i++) teams.push([men[i].id, women[i].id]);
    left.push(...men.slice(n).map((p) => p.id), ...women.slice(n).map((p) => p.id));
  }
  return { teams: shuffle(teams, rand), left };
}

export type BracketMatch = { round: number; slot: number; a: number[]; b: number[]; isBye: boolean };

/** Bagan gugur. Tim yang dapat bye langsung ditempatkan di ronde 2. */
export function buildBracket(teams: number[][]): BracketMatch[] {
  const n = teams.length;
  if (n < 2) return [];
  let size = 2;
  while (size < n) size *= 2;
  const byes = size - n;
  const totalRounds = Math.log2(size);
  const matches: BracketMatch[] = [];

  let next = 0;
  for (let slot = 0; slot < size / 2; slot++) {
    // byes < size/2 selalu benar, jadi tidak pernah ada pertandingan bye lawan bye.
    const isBye = slot < byes;
    matches.push({ round: 1, slot, a: teams[next++], b: isBye ? [] : teams[next++], isBye });
  }
  for (let round = 2; round <= totalRounds; round++) {
    for (let slot = 0; slot < size / 2 ** round; slot++) matches.push({ round, slot, a: [], b: [], isBye: false });
  }
  for (const m of matches.filter((x) => x.isBye)) {
    const target = matches.find((x) => x.round === 2 && x.slot === m.slot >> 1);
    if (target) target[m.slot % 2 === 0 ? "a" : "b"] = m.a;
  }
  return matches;
}

export type Standing = {
  id: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
};

/** Klasemen perorangan: di double, skor tim dihitung untuk kedua pemainnya. */
export function standings(playerIds: number[], scored: { sides: Sides; scoreA: number; scoreB: number }[]): Standing[] {
  const table = new Map<number, Standing>(
    playerIds.map((id) => [id, { id, played: 0, won: 0, drawn: 0, lost: 0, pointsFor: 0, pointsAgainst: 0 }])
  );
  for (const m of scored) {
    for (const [side, mine, theirs] of [
      [m.sides.a, m.scoreA, m.scoreB],
      [m.sides.b, m.scoreB, m.scoreA],
    ] as const) {
      for (const id of side) {
        const row = table.get(id);
        if (!row) continue;
        row.played++;
        row.pointsFor += mine;
        row.pointsAgainst += theirs;
        if (mine > theirs) row.won++;
        else if (mine < theirs) row.lost++;
        else row.drawn++;
      }
    }
  }
  return [...table.values()].sort(
    (x, y) =>
      y.won - x.won ||
      y.pointsFor - y.pointsAgainst - (x.pointsFor - x.pointsAgainst) ||
      y.pointsFor - x.pointsFor ||
      x.played - y.played
  );
}

/** Estimasi menit untuk daftar pertandingan per ronde, dengan `courts` lapangan paralel. */
export function estimateMinutes(matchesPerRound: number[], courts: number, matchMinutes: number): number {
  return matchesPerRound.reduce((sum, n) => sum + Math.ceil(n / Math.max(1, courts)) * matchMinutes, 0);
}
