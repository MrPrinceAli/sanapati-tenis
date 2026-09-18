"use client";

import { useActionState, useState } from "react";
import { saveSession } from "@/app/actions/mabar";
import { useI18n } from "../I18nProvider";
import { FormMessage, SubmitButton } from "../ui";

export type SessionValues = {
  id?: number;
  title: string;
  play_date: string;
  location: string;
  mode: "casual" | "tournament";
  format: "singles" | "doubles";
  gender_rule: "any" | "same" | "mixed";
  target_score: number;
  duration_minutes: number;
  match_minutes: number;
  courts_count: number;
  target_plays: number;
  open_edit: number;
};

function Choice<T extends string>({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; disabled?: boolean }[];
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup">
      {options.map((o) => (
        <label
          key={o.value}
          className={`btn btn-sm cursor-pointer ${value === o.value ? "btn-primary" : "btn-ghost"} ${o.disabled ? "pointer-events-none opacity-40" : ""}`}
        >
          <input type="radio" name={name} value={o.value} checked={value === o.value} disabled={o.disabled} onChange={() => onChange(o.value)} className="sr-only" />
          {o.label}
        </label>
      ))}
    </div>
  );
}

export function SessionForm({ initial, locations }: { initial: SessionValues; locations: string[] }) {
  const [state, action] = useActionState(saveSession, null);
  const { t } = useI18n();
  const m = t.mabar;
  const [mode, setMode] = useState(initial.mode);
  const [format, setFormat] = useState(initial.format);
  const [rule, setRule] = useState(initial.gender_rule);
  const [duration, setDuration] = useState(initial.duration_minutes);
  const [matchMinutes, setMatchMinutes] = useState(initial.match_minutes);
  const [courts, setCourts] = useState(initial.courts_count);

  // Mix hanya masuk akal untuk duo.
  const activeRule = format === "singles" && rule === "mixed" ? "any" : rule;
  const rounds = Math.max(1, Math.floor(duration / Math.max(1, matchMinutes)));
  const ruleHint = activeRule === "same" ? m.fRuleSameHint : activeRule === "mixed" ? m.fRuleMixedHint : m.fRuleAnyHint;
  const otherLocation = initial.location && !locations.includes(initial.location) ? [initial.location] : [];

  return (
    <form action={action} className="space-y-6">
      {initial.id && <input type="hidden" name="sessionId" value={initial.id} />}
      <div className="grid gap-4 sm:grid-cols-[1.6fr_1fr_1fr]">
        <div>
          <label htmlFor="mm-title" className="label">{m.fTitle}</label>
          <input id="mm-title" name="title" defaultValue={initial.title} required minLength={3} maxLength={80} className="input" placeholder={m.fTitlePh} />
        </div>
        <div>
          <label htmlFor="mm-date" className="label">{m.fDate}</label>
          <input id="mm-date" name="play_date" type="date" defaultValue={initial.play_date} required className="input" />
        </div>
        <div>
          <label htmlFor="mm-location" className="label">{m.fLocation}</label>
          <select key={initial.location} id="mm-location" name="location" defaultValue={initial.location} className="input">
            {[...locations, ...otherLocation].map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
            <option value="">{m.fLocationOther}</option>
          </select>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <fieldset>
          <legend className="label">{m.fMode}</legend>
          <Choice name="mode" value={mode} onChange={setMode} options={[{ value: "casual", label: m.modeCasual }, { value: "tournament", label: m.modeTournament }]} />
          <p className="mt-2 text-xs text-muted">{mode === "casual" ? m.fModeCasualHint : m.fModeTournamentHint}</p>
        </fieldset>
        <fieldset>
          <legend className="label">{m.fFormat}</legend>
          <Choice name="format" value={format} onChange={setFormat} options={[{ value: "doubles", label: m.fmtDoubles }, { value: "singles", label: m.fmtSingles }]} />
        </fieldset>
      </div>

      <fieldset>
        <legend className="label">{m.fRule}</legend>
        <Choice
          name="gender_rule"
          value={activeRule}
          onChange={setRule}
          options={[
            { value: "any", label: m.ruleAny },
            { value: "same", label: m.ruleSame },
            { value: "mixed", label: m.ruleMixed, disabled: format === "singles" },
          ]}
        />
        <p className="mt-2 text-xs text-muted">{ruleHint}</p>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-4">
        <div>
          <label htmlFor="mm-target" className="label">{m.fTarget}</label>
          <input id="mm-target" name="target_score" type="number" min={1} max={99} defaultValue={initial.target_score} required className="input" />
        </div>
        <div>
          <label htmlFor="mm-duration" className="label">{m.fDuration}</label>
          <input id="mm-duration" name="duration_minutes" type="number" min={15} max={600} step={5} value={duration} onChange={(e) => setDuration(Number(e.target.value))} required className="input" />
        </div>
        <div>
          <label htmlFor="mm-match" className="label">{m.fMatchMinutes}</label>
          <input id="mm-match" name="match_minutes" type="number" min={5} max={120} value={matchMinutes} onChange={(e) => setMatchMinutes(Number(e.target.value))} required className="input" />
        </div>
        <div>
          <label htmlFor="mm-courts" className="label">{m.fCourts}</label>
          <input id="mm-courts" name="courts_count" type="number" min={1} max={8} value={courts} onChange={(e) => setCourts(Number(e.target.value))} required className="input" />
        </div>
      </div>
      <p className="-mt-3 text-xs text-muted">
        {m.fTargetHint} · {m.planOk(rounds, rounds * matchMinutes)} × {m.sumCourts(courts)}
      </p>

      {mode === "casual" ? (
        <div>
          <label htmlFor="mm-plays" className="label">{m.fPlays}</label>
          <select key={initial.target_plays} id="mm-plays" name="target_plays" defaultValue={initial.target_plays} className="input sm:w-auto">
            <option value={0}>{m.fPlaysFill}</option>
            {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
              <option key={n} value={n}>{m.fPlaysN(n)}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted">{m.fPlaysHint}</p>
        </div>
      ) : (
        <input type="hidden" name="target_plays" value={0} />
      )}

      <label className="flex items-start gap-3 rounded-xl bg-cream p-3.5 text-sm">
        <input key={initial.open_edit} type="checkbox" name="open_edit" defaultChecked={!!initial.open_edit} className="mt-0.5 h-4 w-4 accent-court-700" />
        <span>
          <span className="font-medium">{m.fOpenEdit}</span>
          <span className="block text-xs text-muted">{m.fOpenEditHint}</span>
        </span>
      </label>

      <FormMessage state={state} />
      <SubmitButton>{initial.id ? m.save : m.createBtn}</SubmitButton>
    </form>
  );
}
