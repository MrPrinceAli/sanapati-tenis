"use client";

import { useActionState } from "react";
import { blockSlot, saveCourt } from "@/app/actions/admin";
import { opt } from "@/lib/i18n";
import { SURFACES } from "@/lib/options";
import { CLOSE_HOUR, EARLIEST_HOUR, HOURS, OPEN_HOUR, hourRange } from "@/lib/time";
import { useI18n } from "../I18nProvider";
import { FormMessage, SubmitButton } from "../ui";

type CourtData = {
  id: number;
  name: string;
  surface: string;
  indoor: number;
  description: string;
  active: number;
  open_hour: number;
  close_hour: number;
};

// React 19 me-reset form setelah action, tapi <select>/checkbox tidak mengikuti defaultValue baru dari server.
// `key` dari nilai server memaksa elemen dipasang ulang, jadi yang tampil selalu data tersimpan terakhir.
export function CourtForm({ court }: { court?: CourtData }) {
  const [state, action] = useActionState(saveCourt, null);
  const { t, f } = useI18n();
  const c = t.admin.courts;
  const uid = court?.id ?? "new";
  return (
    <form action={action} className="space-y-3">
      {court && <input type="hidden" name="id" value={court.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`name-${uid}`} className="label">{c.name}</label>
          <input id={`name-${uid}`} name="name" defaultValue={court?.name} required className="input" />
        </div>
        <div>
          <label htmlFor={`surface-${uid}`} className="label">{c.surface}</label>
          <select key={court?.surface} id={`surface-${uid}`} name="surface" defaultValue={court?.surface ?? SURFACES[0]} className="input">
            {SURFACES.map((s) => (
              <option key={s} value={s}>{opt(t, s)}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`open-${uid}`} className="label">{t.courtHours.open}</label>
          <select key={court?.open_hour} id={`open-${uid}`} name="open_hour" defaultValue={court?.open_hour ?? OPEN_HOUR} className="input">
            {hourRange(EARLIEST_HOUR, CLOSE_HOUR).map((h) => (
              <option key={h} value={h}>{f.hour(h)}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`close-${uid}`} className="label">{t.courtHours.close}</label>
          <select key={court?.close_hour} id={`close-${uid}`} name="close_hour" defaultValue={court?.close_hour ?? CLOSE_HOUR} className="input">
            {hourRange(EARLIEST_HOUR + 1, CLOSE_HOUR + 1).map((h) => (
              <option key={h} value={h}>{f.hour(h)}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor={`desc-${uid}`} className="label">{c.description}</label>
        <textarea id={`desc-${uid}`} name="description" rows={2} maxLength={300} defaultValue={court?.description} className="input resize-none" />
      </div>
      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2">
          <input key={court?.indoor} type="checkbox" name="indoor" defaultChecked={!!court?.indoor} className="h-4 w-4 accent-court-700" /> {t.common.indoor}
        </label>
        <label className="flex items-center gap-2">
          <input key={court?.active} type="checkbox" name="active" defaultChecked={court ? !!court.active : true} className="h-4 w-4 accent-court-700" /> {c.activeLabel}
        </label>
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn btn-primary btn-sm">{court ? c.save : c.addBtn}</SubmitButton>
    </form>
  );
}

export function BlockForm({ courts, minDate, maxDate }: { courts: { id: number; name: string }[]; minDate: string; maxDate: string }) {
  const [state, action] = useActionState(blockSlot, null);
  const { t, f } = useI18n();
  const c = t.admin.courts;
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="block-court" className="label">{c.court}</label>
          <select id="block-court" name="courtId" className="input">
            {courts.map((court) => (
              <option key={court.id} value={court.id}>{court.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="block-date" className="label">{c.date}</label>
          <input id="block-date" name="date" type="date" min={minDate} max={maxDate} defaultValue={minDate} required className="input" />
        </div>
        <div>
          <label htmlFor="block-start" className="label">{c.from}</label>
          <select id="block-start" name="start" className="input">
            {HOURS.map((h) => (
              <option key={h} value={h}>{f.hour(h)}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="block-end" className="label">{c.to}</label>
          <select id="block-end" name="end" defaultValue={CLOSE_HOUR} className="input">
            {HOURS.map((h) => (
              <option key={h + 1} value={h + 1}>{f.hour(h + 1)}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="block-note" className="label">{c.note}</label>
        <input id="block-note" name="note" maxLength={100} className="input" placeholder={c.notePh} />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn btn-primary btn-sm">{c.blockSubmit}</SubmitButton>
    </form>
  );
}
