"use client";

import { useActionState, useRef, useState } from "react";
import { changePassword, updateAccount, updateAvatar, updateProfile } from "@/app/actions/account";
import { opt } from "@/lib/i18n";
import { BACKHANDS, HANDS, LEVELS, REMINDER_MINUTES } from "@/lib/options";
import { Avatar } from "./Avatar";
import { useI18n } from "./I18nProvider";
import { FormMessage, SubmitButton } from "./ui";

type AccountData = { name: string; email: string; phone: string; reminder_minutes: number };
type ProfileData = {
  name: string;
  level: string;
  hand: string;
  backhand: string;
  city: string;
  bio: string;
  avatar_hue: number;
  avatar: string;
  is_public: boolean;
};

// React 19 me-reset form setelah action, tapi <select>/checkbox tidak mengikuti defaultValue baru dari server.
// `key` dari nilai server memaksa elemen dipasang ulang, jadi yang tampil selalu data tersimpan terakhir.
export function AccountForm({ data }: { data: AccountData }) {
  const [state, action] = useActionState(updateAccount, null);
  const { t } = useI18n();
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="label">{t.account.name}</label>
          <input id="name" name="name" defaultValue={data.name} required className="input" />
        </div>
        <div>
          <label htmlFor="phone" className="label">{t.account.phone}</label>
          <input id="phone" name="phone" type="tel" defaultValue={data.phone} required className="input" />
        </div>
      </div>
      <div>
        <label htmlFor="email" className="label">{t.account.email}</label>
        <input id="email" value={data.email} disabled className="input bg-cream text-muted" />
      </div>
      <div>
        <label htmlFor="reminder_minutes" className="label">{t.account.reminder}</label>
        <select key={data.reminder_minutes} id="reminder_minutes" name="reminder_minutes" defaultValue={data.reminder_minutes} className="input">
          {REMINDER_MINUTES.map((m) => (
            <option key={m} value={m}>{t.reminder.option(m)}</option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted">{t.account.reminderHint}</p>
      </div>
      <FormMessage state={state} />
      <SubmitButton>{t.account.saveAccount}</SubmitButton>
    </form>
  );
}

export function ProfileForm({ data }: { data: ProfileData }) {
  const [state, action] = useActionState(updateProfile, null);
  const [hue, setHue] = useState(data.avatar_hue);
  const { t } = useI18n();
  const select = (id: "level" | "hand" | "backhand", label: string, values: string[]) => (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <select key={data[id]} id={id} name={id} defaultValue={data[id]} className="input">
        {values.map((v) => (
          <option key={v} value={v}>{opt(t, v)}</option>
        ))}
      </select>
    </div>
  );
  return (
    <form action={action} className="space-y-4">
      <div className={`flex items-center gap-4 ${data.avatar ? "hidden" : ""}`}>
        <Avatar name={data.name} hue={hue} size={64} />
        <div className="flex-1">
          <label htmlFor="avatar_hue" className="label">{t.account.avatarColor}</label>
          <input
            id="avatar_hue"
            name="avatar_hue"
            type="range"
            min={0}
            max={359}
            value={hue}
            onChange={(e) => setHue(Number(e.target.value))}
            className="w-full accent-court-700"
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {select("level", t.account.level, LEVELS)}
        {select("hand", t.account.hand, HANDS)}
        {select("backhand", t.account.backhand, BACKHANDS)}
      </div>
      <div>
        <label htmlFor="city" className="label">{t.account.city}</label>
        <input id="city" name="city" defaultValue={data.city} maxLength={60} className="input" placeholder={t.account.cityPh} />
      </div>
      <div>
        <label htmlFor="bio" className="label">{t.account.bio}</label>
        <textarea id="bio" name="bio" defaultValue={data.bio} rows={3} maxLength={280} className="input resize-none" placeholder={t.account.bioPh} />
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input key={String(data.is_public)} type="checkbox" name="is_public" defaultChecked={data.is_public} className="mt-0.5 h-4 w-4 accent-court-700" />
        <span>
          <span className="font-medium">{t.account.publicLabel}</span>
          <span className="block text-xs text-muted">{t.account.publicHint}</span>
        </span>
      </label>
      <FormMessage state={state} />
      <SubmitButton>{t.account.saveProfile}</SubmitButton>
    </form>
  );
}

// Form terpisah dari ProfileForm: upload langsung tersimpan begitu file dipilih.
export function AvatarForm({ name, hue, avatar }: { name: string; hue: number; avatar: string }) {
  const [state, action] = useActionState(updateAvatar, null);
  const { t } = useI18n();
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={action} className="flex flex-wrap items-center gap-4">
      <Avatar name={name} hue={hue} avatar={avatar} size={72} />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="label mb-0">{t.avatar.label}</p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="btn btn-ghost btn-sm">
            {avatar ? t.avatar.change : t.avatar.upload}
            <input
              type="file"
              name="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => e.target.files?.length && form.current?.requestSubmit()}
            />
          </label>
          {avatar && (
            <button name="remove" value="1" className="btn btn-sm text-clay-700 hover:underline">
              {t.avatar.remove}
            </button>
          )}
        </div>
        <p className="text-xs text-muted">{t.avatar.hint}</p>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, null);
  const { t } = useI18n();
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="current" className="label">{t.account.currentPw}</label>
          <input id="current" name="current" type="password" autoComplete="current-password" required className="input" />
        </div>
        <div>
          <label htmlFor="next" className="label">{t.account.newPw}</label>
          <input id="next" name="next" type="password" autoComplete="new-password" required minLength={8} className="input" />
        </div>
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn btn-ghost">{t.account.changePw}</SubmitButton>
    </form>
  );
}
