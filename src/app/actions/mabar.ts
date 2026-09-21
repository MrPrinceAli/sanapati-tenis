"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db, type User } from "@/lib/db";
import type { FormState } from "@/lib/form";
import type { Dict } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n-server";
import {
  LIMITS,
  canContribute,
  canManage,
  getMatches,
  getPlayers,
  getSession,
  isScored,
  sidesOf,
  type MMMatch,
  type MMSession,
} from "@/lib/mabar";
import { buildBracket, effectiveRule, formTeams, planRounds, teamSize, type Sides } from "@/lib/matchmaking";
import { isValidDate } from "@/lib/time";

const MODES = ["casual", "tournament"];
const FORMATS = ["singles", "doubles"];
const RULES = ["any", "same", "mixed"];
const between = (n: number, [min, max]: readonly [number, number]) => Number.isInteger(n) && n >= min && n <= max;

// Setiap action memuat sesi + mengecek hak kelola sendiri: server action bisa dipanggil siapa saja.
async function manageable(form: FormData, t: Dict): Promise<{ session: MMSession; user: User } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: t.errors.sessionExpired };
  const session = await getSession(Number(form.get("sessionId")));
  if (!session) return { error: t.errors.mmNotFound };
  if (!canManage(session, user)) return { error: t.errors.mmForbidden };
  return { session, user };
}

// Pengunjung tanpa login boleh menulis skor/nama, jadi dibatasi lajunya per alamat IP.
// Catatan: penghitungnya ada di memori proses; di serverless tiap instance punya hitungan sendiri, jadi ini peredam, bukan pagar mutlak.
const hits = new Map<string, { count: number; resetAt: number }>();
async function tooFast(): Promise<boolean> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "local";
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.resetAt < now) {
    if (hits.size > 5000) hits.clear();
    hits.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  return ++entry.count > 40;
}

// Untuk aksi yang terbuka bagi publik: tidak wajib login, tapi sesi harus mengizinkannya.
async function contributable(form: FormData, t: Dict): Promise<{ session: MMSession } | { error: string }> {
  const user = await getCurrentUser();
  const session = await getSession(Number(form.get("sessionId")));
  if (!session) return { error: t.errors.mmNotFound };
  if (!canContribute(session, user)) return { error: t.errors.mmClosed };
  if (!user && (await tooFast())) return { error: t.errors.mmTooFast };
  return { session };
}

const refresh = (id: number) => {
  revalidatePath(`/mabar/${id}`);
  revalidatePath("/mabar");
};

export async function saveSession(_: FormState, form: FormData): Promise<FormState> {
  const { t } = await getI18n();
  const user = await getCurrentUser();
  if (!user) return { error: t.errors.sessionExpired };

  const id = Number(form.get("sessionId")) || null;
  const title = String(form.get("title") ?? "").trim();
  const playDate = String(form.get("play_date") ?? "");
  const location = String(form.get("location") ?? "").trim().slice(0, 60);
  const mode = String(form.get("mode") ?? "");
  const format = String(form.get("format") ?? "");
  const rule = String(form.get("gender_rule") ?? "");
  const target = Number(form.get("target_score"));
  const duration = Number(form.get("duration_minutes"));
  const matchMinutes = Number(form.get("match_minutes"));
  const courts = Number(form.get("courts_count"));
  const plays = Number(form.get("target_plays"));
  const openEdit = form.get("open_edit") ? 1 : 0;

  if (title.length < 3 || title.length > 80) return { error: t.errors.mmTitle };
  if (!isValidDate(playDate)) return { error: t.errors.invalidDate };
  if (!MODES.includes(mode) || !FORMATS.includes(format) || !RULES.includes(rule)) return { error: t.errors.optionInvalid };
  if (
    !between(target, LIMITS.target) ||
    !between(duration, LIMITS.duration) ||
    !between(matchMinutes, LIMITS.matchMinutes) ||
    !between(courts, LIMITS.courts) ||
    !between(plays, LIMITS.plays)
  ) {
    return { error: t.errors.mmNumbers };
  }
  const genderRule = effectiveRule(format as "singles" | "doubles", rule as "any" | "same" | "mixed");
  const values = [title, playDate, location, mode, format, genderRule, target, duration, matchMinutes, courts, mode === "casual" ? plays : 0, openEdit];

  if (!id) {
    const info = await db.run(
      `INSERT INTO mm_sessions (title, play_date, location, mode, format, gender_rule, target_score, duration_minutes,
                                match_minutes, courts_count, target_plays, open_edit, owner_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ...values,
      user.id
    );
    revalidatePath("/mabar");
    redirect(`/mabar/${info.lastInsertRowid}`);
  }

  const session = await getSession(id);
  if (!session) return { error: t.errors.mmNotFound };
  if (!canManage(session, user)) return { error: t.errors.mmForbidden };
  // Ganti jenis/mode membuat jadwal lama tidak berlaku: boleh hanya selama belum ada skor.
  if (session.mode !== mode || session.format !== format) {
    if ((await getMatches(id)).some(isScored)) return { error: t.errors.mmHasScores };
    await db.run("DELETE FROM mm_matches WHERE session_id = ?", id);
  }
  await db.run(
    `UPDATE mm_sessions SET title=?, play_date=?, location=?, mode=?, format=?, gender_rule=?, target_score=?,
       duration_minutes=?, match_minutes=?, courts_count=?, target_plays=?, open_edit=? WHERE id=?`,
    ...values,
    id
  );
  refresh(id);
  return { ok: t.ok.sessionSaved };
}

export async function addPlayers(_: FormState, form: FormData): Promise<FormState> {
  const { t } = await getI18n();
  const ctx = await contributable(form, t);
  if ("error" in ctx) return ctx;

  const gender = form.get("gender") === "F" ? "F" : "M";
  const names = String(form.get("names") ?? "")
    .split(/[\n,;]+/)
    .map((n) => n.trim().replace(/\s+/g, " "))
    .filter(Boolean);
  if (names.length === 0 || names.some((n) => n.length > 40)) return { error: t.errors.mmPlayerName };
  const current = (await getPlayers(ctx.session.id)).filter((p) => p.active).length;
  if (current + names.length > LIMITS.players) return { error: t.errors.mmTooManyPlayers };

  await db.batch(names.map((n) => ({ sql: "INSERT INTO mm_players (session_id, name, gender) VALUES (?,?,?)", args: [ctx.session.id, n, gender] })));
  refresh(ctx.session.id);
  return { ok: "", values: { gender } };
}

export async function renamePlayer(_: FormState, form: FormData): Promise<FormState> {
  const { t } = await getI18n();
  const ctx = await contributable(form, t);
  if ("error" in ctx) return ctx;
  const name = String(form.get("name") ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 40) return { error: t.errors.mmPlayerName };
  const gender = form.get("gender") === "F" ? "F" : "M";
  await db.run("UPDATE mm_players SET name = ?, gender = ? WHERE id = ? AND session_id = ?", name, gender, Number(form.get("playerId")), ctx.session.id);
  refresh(ctx.session.id);
  return { ok: t.ok.sessionSaved };
}

export async function removePlayer(_: FormState, form: FormData): Promise<FormState> {
  const { t } = await getI18n();
  const ctx = await manageable(form, t);
  if ("error" in ctx) return ctx;
  const playerId = Number(form.get("playerId"));
  const { session } = ctx;

  const involved = (await getMatches(session.id)).filter((m) => [m.a1, m.a2, m.b1, m.b2].includes(playerId));
  if (involved.length === 0) {
    await db.run("DELETE FROM mm_players WHERE id = ? AND session_id = ?", playerId, session.id);
  } else if (session.mode === "tournament") {
    return { error: t.errors.mmPlayerBusy };
  } else {
    // Riwayat skor dipertahankan: pemain ditandai keluar, pertandingannya yang belum dimainkan dibuang.
    await db.batch([
      { sql: "UPDATE mm_players SET active = 0 WHERE id = ? AND session_id = ?", args: [playerId, session.id] },
      ...involved.filter((m) => !isScored(m)).map((m) => ({ sql: "DELETE FROM mm_matches WHERE id = ?", args: [m.id] })),
    ]);
  }
  refresh(session.id);
  return { ok: "" };
}

const INSERT_MATCH = "INSERT INTO mm_matches (session_id, round, slot, a1, a2, b1, b2, is_bye) VALUES (?,?,?,?,?,?,?,?)";
const matchArgs = (sessionId: number, round: number, slot: number, s: Sides, bye: boolean) => [
  sessionId,
  round,
  slot,
  s.a[0] ?? null,
  s.a[1] ?? null,
  s.b[0] ?? null,
  s.b[1] ?? null,
  bye ? 1 : 0,
];

/** `kind`: "full" = susun/susun ulang semua yang belum dimainkan · "round" = tambah tepat satu ronde. */
export async function generateMatches(_: FormState, form: FormData): Promise<FormState> {
  const { t } = await getI18n();
  const ctx = await manageable(form, t);
  if ("error" in ctx) return ctx;
  const { session } = ctx;
  const players = (await getPlayers(session.id)).filter((p) => p.active);
  const matches = await getMatches(session.id);
  if (players.length < teamSize(session.format) * 2) return { error: t.errors.mmNotEnough };

  // Susunan dihitung dulu di memori, lalu hapus-lama + sisip-baru dikirim sebagai satu batch atomik.
  const stmts: { sql: string; args: unknown[] }[] = [];
  if (session.mode === "tournament") {
    if (matches.some(isScored)) return { error: t.errors.mmHasScores };
    const { teams } = formTeams(players, session.format, session.gender_rule);
    const bracket = buildBracket(teams);
    if (bracket.length === 0) return { error: teams.length < 2 && players.length >= 4 ? t.errors.mmBlocked : t.errors.mmNotEnough };
    stmts.push({ sql: "DELETE FROM mm_matches WHERE session_id = ?", args: [session.id] });
    for (const m of bracket) stmts.push({ sql: INSERT_MATCH, args: matchArgs(session.id, m.round, m.slot, m, m.isBye) });
  } else {
    const addOne = form.get("kind") === "round";
    const kept = addOne ? matches : matches.filter(isScored);
    const lastRound = Math.max(0, ...kept.map((m) => m.round));
    const budget = Math.max(1, Math.floor(session.duration_minutes / session.match_minutes));
    const planned = planRounds(
      players,
      kept.map((m) => ({ round: m.round, sides: sidesOf(m) })),
      {
        format: session.format,
        genderRule: session.gender_rule,
        courts: session.courts_count,
        maxRounds: addOne ? lastRound + 1 : Math.max(budget, lastRound + 1),
        targetPlays: addOne ? 0 : session.target_plays,
      },
      lastRound + 1
    );
    // Target main sudah tercapai bukan kegagalan; aturan gender yang mustahil dipenuhi, iya.
    // `reached` harus benar-benar memeriksa jumlah main tiap pemain: sebelumnya cukup ada satu skor
    // tersimpan untuk dianggap "target tercapai", sehingga aturan gender yang mustahil pun dilaporkan
    // sebagai sukses — lalu seluruh ronde yang belum berskor dihapus tanpa penjelasan.
    const mainSejauhIni = new Map(players.map((p) => [p.id, 0]));
    for (const m of kept) {
      const sisi = sidesOf(m);
      for (const pid of [...sisi.a, ...sisi.b]) mainSejauhIni.set(pid, (mainSejauhIni.get(pid) ?? 0) + 1);
    }
    const reached =
      session.target_plays > 0 &&
      !addOne &&
      players.length > 0 &&
      players.every((p) => (mainSejauhIni.get(p.id) ?? 0) >= session.target_plays);
    if (planned.length === 0 && !reached) return { error: t.errors.mmBlocked };
    if (!addOne) matches.filter((m) => !isScored(m)).forEach((m) => stmts.push({ sql: "DELETE FROM mm_matches WHERE id = ?", args: [m.id] }));
    for (const r of planned) r.matches.forEach((m, slot) => stmts.push({ sql: INSERT_MATCH, args: matchArgs(session.id, r.round, slot, m, false) }));
  }
  // Aturan gender bisa menyisihkan sebagian pemain sepenuhnya — misal 3 wanita pada aturan
  // "sesama gender" format duo: satu tim butuh 4 orang, jadi mereka tidak pernah bisa dipasangkan.
  // Undiannya sah, tapi sebelumnya mereka lenyap dari jadwal tanpa peringatan apa pun.
  const tampil = new Set<number>();
  for (const st of stmts) {
    if (st.sql !== INSERT_MATCH) continue;
    for (const v of st.args) if (typeof v === "number") tampil.add(v);
  }
  const tertinggal = players.filter((p) => !tampil.has(p.id));

  stmts.push({ sql: "UPDATE mm_sessions SET finished = 0 WHERE id = ?", args: [session.id] });
  await db.batch(stmts);
  refresh(session.id);
  return { ok: tertinggal.length ? t.ok.mmLeftOut(tertinggal.map((p) => p.name).join(", ")) : "" };
}

export async function saveScore(_: FormState, form: FormData): Promise<FormState> {
  const { t } = await getI18n();
  const ctx = await contributable(form, t);
  if ("error" in ctx) return ctx;
  const { session } = ctx;
  const match = await db.get<MMMatch>("SELECT * FROM mm_matches WHERE id = ? AND session_id = ?", Number(form.get("matchId")), session.id);
  if (!match || match.is_bye) return { error: t.errors.mmNotFound };
  if (match.a1 === null || match.b1 === null) return { error: t.errors.mmNotReady };

  const clear = !!form.get("clear");
  const a = Number(form.get("score_a"));
  const b = Number(form.get("score_b"));
  // Number(null) dan Number(" ") sama-sama 0, jadi field yang hilang atau berisi spasi akan
  // tersimpan diam-diam sebagai 0-0. Isian diperiksa sebagai teks dulu, bukan hanya != "".
  const isiAngka = (v: FormDataEntryValue | null) => typeof v === "string" && v.trim() !== "";
  if (!clear && (!isiAngka(form.get("score_a")) || !isiAngka(form.get("score_b")) || !between(a, [0, 99]) || !between(b, [0, 99]))) {
    return { error: t.errors.mmScore };
  }

  const stmts: { sql: string; args: unknown[] }[] = [
    { sql: "UPDATE mm_matches SET score_a = ?, score_b = ? WHERE id = ?", args: [clear ? null : a, clear ? null : b, match.id] },
  ];
  if (session.mode === "tournament") {
    if (!clear && a === b) return { error: t.errors.mmNoDraw };
    const next = await db.get<MMMatch>("SELECT * FROM mm_matches WHERE session_id = ? AND round = ? AND slot = ?", session.id, match.round + 1, match.slot >> 1);
    if (next && isScored(next)) return { error: t.errors.mmLocked };
    if (next) {
      // Pemenang (atau kekosongan, saat skor dihapus) diteruskan ke slot babak berikutnya.
      const s = sidesOf(match);
      const winner = clear ? null : a > b ? s.a : s.b;
      const side = match.slot % 2 === 0 ? "a" : "b";
      stmts.push({ sql: `UPDATE mm_matches SET ${side}1 = ?, ${side}2 = ? WHERE id = ?`, args: [winner?.[0] ?? null, winner?.[1] ?? null, next.id] });
    }
  }
  await db.batch(stmts);
  refresh(session.id);
  return { ok: t.ok.scoreSaved };
}

export async function toggleFinished(form: FormData) {
  const { t } = await getI18n();
  const ctx = await manageable(form, t);
  if ("error" in ctx) return;
  await db.run("UPDATE mm_sessions SET finished = ? WHERE id = ?", ctx.session.finished ? 0 : 1, ctx.session.id);
  refresh(ctx.session.id);
}

export async function deleteSession(form: FormData) {
  const { t } = await getI18n();
  const ctx = await manageable(form, t);
  if ("error" in ctx) return;
  // Urutan mengikuti foreign key (pertandingan → pemain → sesi), eksplisit supaya tidak bergantung pada pengaturan CASCADE di server database.
  await db.batch([
    { sql: "DELETE FROM mm_matches WHERE session_id = ?", args: [ctx.session.id] },
    { sql: "DELETE FROM mm_players WHERE session_id = ?", args: [ctx.session.id] },
    { sql: "DELETE FROM mm_sessions WHERE id = ?", args: [ctx.session.id] },
  ]);
  revalidatePath("/mabar");
  redirect("/mabar");
}
