"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { addPlayers, deleteSession, generateMatches, removePlayer, renamePlayer, saveScore, toggleFinished } from "@/app/actions/mabar";
import { useI18n } from "../I18nProvider";
import { FormMessage, SubmitButton } from "../ui";

/** Penonton melihat skor terbaru tanpa perlu me-refresh manual — "layaknya dashboard". */
export function AutoRefresh({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => document.visibilityState === "visible" && router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}

export function AddPlayerForm({ sessionId }: { sessionId: number }) {
  const [state, action] = useActionState(addPlayers, null);
  const { t } = useI18n();
  const m = t.mabar;
  const [gender, setGender] = useState<"M" | "F">("M");
  const input = useRef<HTMLTextAreaElement>(null);

  // Form di-reset setelah tiap tambah; fokus kembali ke kolom nama supaya bisa mengetik berurutan.
  useEffect(() => {
    if (state?.ok === "") input.current?.focus();
  }, [state]);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="gender" value={gender} />
      <div className="flex flex-wrap gap-2">
        {/* textarea, bukan input: <input> membuang baris baru saat menempel daftar nama. Enter = kirim, Shift+Enter = baris baru. */}
        <textarea
          ref={input}
          name="names"
          required
          rows={1}
          maxLength={2000}
          aria-label={m.addName}
          placeholder={m.addNamePh}
          className="input min-w-40 flex-1 resize-none [field-sizing:content]"
          autoComplete="off"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <div className="flex overflow-hidden rounded-xl border border-line" role="radiogroup" aria-label={`${m.male} / ${m.female}`}>
          {(["M", "F"] as const).map((g) => (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={gender === g}
              onClick={() => setGender(g)}
              className={`cursor-pointer px-3.5 text-sm font-semibold transition ${gender === g ? "bg-court-900 text-cream" : "bg-white text-muted hover:text-ink"}`}
            >
              {g === "M" ? m.male : m.female}
            </button>
          ))}
        </div>
        <SubmitButton className="btn btn-primary">{m.add}</SubmitButton>
      </div>
      <p className="text-xs text-muted">{m.bulkHint}</p>
      <FormMessage state={state?.error ? state : null} />
    </form>
  );
}

type ChipPlayer = { id: number; name: string; gender: "M" | "F"; active: number };

/** Chip pemain. `canEdit` = boleh ubah nama/gender (siapa pun di sesi terbuka); `canRemove` = khusus pengelola. */
export function PlayerChip({ sessionId, player, canEdit, canRemove }: { sessionId: number; player: ChipPlayer; canEdit: boolean; canRemove: boolean }) {
  const [state, action] = useActionState(renamePlayer, null);
  const { t } = useI18n();
  const m = t.mabar;
  const [editing, setEditing] = useState(false);
  const [gender, setGender] = useState(player.gender);

  useEffect(() => {
    if (state?.ok) setEditing(false);
  }, [state]);

  if (editing) {
    return (
      <li className="w-full rounded-xl border border-court-600 bg-white p-2">
        <form action={action} className="flex flex-wrap items-center gap-1.5">
          <input type="hidden" name="sessionId" value={sessionId} />
          <input type="hidden" name="playerId" value={player.id} />
          <input type="hidden" name="gender" value={gender} />
          <input name="name" defaultValue={player.name} required maxLength={40} autoFocus aria-label={m.addName} className="input min-w-28 flex-1 px-2.5 py-1.5" />
          <div className="flex overflow-hidden rounded-lg border border-line" role="radiogroup" aria-label={`${m.male} / ${m.female}`}>
            {(["M", "F"] as const).map((g) => (
              <button key={g} type="button" role="radio" aria-checked={gender === g} onClick={() => setGender(g)} className={`cursor-pointer px-2.5 py-1.5 text-xs font-semibold ${gender === g ? "bg-court-900 text-cream" : "bg-white text-muted"}`}>
                {g === "M" ? m.male : m.female}
              </button>
            ))}
          </div>
          <SubmitButton className="btn btn-primary btn-sm" pendingText="…">{m.save}</SubmitButton>
          <button type="button" className="cursor-pointer px-1 text-xs text-muted hover:text-ink" onClick={() => setEditing(false)}>
            {m.cancel}
          </button>
          {state?.error && <p role="alert" className="w-full text-xs text-clay-700">{state.error}</p>}
        </form>
      </li>
    );
  }
  return (
    <li className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-cream py-1 pl-1 pr-2 text-sm ${player.active ? "" : "opacity-50"}`}>
      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${player.gender === "F" ? "bg-clay-100 text-clay-700" : "bg-court-100 text-court-800"}`}>
        {player.gender === "F" ? m.femaleShort : m.maleShort}
      </span>
      {canEdit && player.active ? (
        <button type="button" onClick={() => setEditing(true)} aria-label={m.editPlayer(player.name)} title={m.editPlayer(player.name)} className="cursor-pointer underline decoration-line decoration-dotted underline-offset-4 hover:decoration-court-700">
          {player.name}
        </button>
      ) : (
        <span className={player.active ? "" : "line-through"}>{player.name}</span>
      )}
      {!player.active && <span className="text-xs text-muted">({m.inactive})</span>}
      {canRemove && player.active && <RemovePlayerButton sessionId={sessionId} playerId={player.id} name={player.name} />}
    </li>
  );
}

export function RemovePlayerButton({ sessionId, playerId, name }: { sessionId: number; playerId: number; name: string }) {
  const [state, action] = useActionState(removePlayer, null);
  const { t } = useI18n();
  return (
    <form action={action} className="inline-flex items-center">
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="playerId" value={playerId} />
      <button aria-label={t.mabar.removeAria(name)} title={state?.error ?? t.mabar.remove} className={`cursor-pointer px-1 text-base leading-none hover:text-clay-700 ${state?.error ? "text-clay-600" : "text-muted"}`}>
        ×
      </button>
      {state?.error && <span role="alert" className="sr-only">{state.error}</span>}
    </form>
  );
}

export function ScoreForm({
  sessionId,
  matchId,
  scoreA,
  scoreB,
  labelA,
  labelB,
  max,
}: {
  sessionId: number;
  matchId: number;
  scoreA: number | null;
  scoreB: number | null;
  labelA: string;
  labelB: string;
  max: number;
}) {
  const [state, action] = useActionState(saveScore, null);
  const { t } = useI18n();
  const m = t.mabar;
  const scored = scoreA !== null && scoreB !== null;
  const [editing, setEditing] = useState(!scored);

  useEffect(() => {
    if (state?.ok) setEditing(false);
  }, [state]);

  if (!editing && scored) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="cursor-pointer text-xs font-medium text-court-700 hover:underline">
        {m.editScore}
      </button>
    );
  }
  return (
    <form action={action} className="flex flex-wrap items-center justify-end gap-1.5">
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="matchId" value={matchId} />
      <input name="score_a" type="number" inputMode="numeric" min={0} max={99} defaultValue={scoreA ?? ""} placeholder={String(max)} aria-label={m.scoreAria(labelA)} className="input w-14 px-2 py-1.5 text-center tabular-nums" />
      <span className="text-muted">–</span>
      <input name="score_b" type="number" inputMode="numeric" min={0} max={99} defaultValue={scoreB ?? ""} placeholder="0" aria-label={m.scoreAria(labelB)} className="input w-14 px-2 py-1.5 text-center tabular-nums" />
      <SubmitButton className="btn btn-primary btn-sm" pendingText="…">{m.saveScore}</SubmitButton>
      {scored && (
        <button name="clear" value="1" className="cursor-pointer text-xs text-clay-700 hover:underline">
          {m.clearScore}
        </button>
      )}
      {state?.error && <p role="alert" className="w-full text-right text-xs text-clay-700">{state.error}</p>}
    </form>
  );
}

export function ManageBar({
  sessionId,
  mode,
  hasMatches,
  finished,
  canGenerate,
}: {
  sessionId: number;
  mode: "casual" | "tournament";
  hasMatches: boolean;
  finished: boolean;
  canGenerate: boolean;
}) {
  const [state, action] = useActionState(generateMatches, null);
  const { t } = useI18n();
  const m = t.mabar;
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <form action={action} className={canGenerate ? "contents" : "hidden"}>
          <input type="hidden" name="sessionId" value={sessionId} />
          <SubmitButton className="btn btn-ball">{hasMatches ? m.regenerate : m.generate}</SubmitButton>
          {mode === "casual" && hasMatches && (
            <button name="kind" value="round" className="btn btn-ghost">
              {m.addRound}
            </button>
          )}
        </form>
        {hasMatches && (
          <form action={toggleFinished}>
            <input type="hidden" name="sessionId" value={sessionId} />
            <button className="btn btn-ghost">{finished ? m.reopen : m.finish}</button>
          </form>
        )}
        <button type="button" className="btn ml-auto text-clay-700 hover:underline" onClick={() => dialog.current?.showModal()}>
          {m.deleteSession}
        </button>
      </div>
      <FormMessage state={state?.error ? state : null} />

      <dialog
        ref={dialog}
        className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-3xl border border-line bg-white p-6 text-ink backdrop:bg-court-950/50"
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      >
        <p className="font-display text-lg font-semibold">{m.deleteConfirm}</p>
        <form action={deleteSession} className="mt-5 flex justify-end gap-2">
          <input type="hidden" name="sessionId" value={sessionId} />
          <button type="button" className="btn btn-ghost" onClick={() => dialog.current?.close()}>
            {t.common.close}
          </button>
          <button className="btn btn-danger">{m.yesDelete}</button>
        </form>
      </dialog>
    </div>
  );
}
