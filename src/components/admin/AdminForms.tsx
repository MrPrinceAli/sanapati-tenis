"use client";

import { useActionState } from "react";
import { adminSaveUser, saveSiteSettings, updateGalleryItem } from "@/app/actions/admin-control";
import { opt } from "@/lib/i18n";
import { BACKHANDS, GALLERY_CATEGORIES, HANDS, LEVELS } from "@/lib/options";
import { RULE_BOUNDS, type Rules } from "@/lib/rules";
import { useI18n } from "../I18nProvider";
import { FormMessage, SubmitButton } from "../ui";

export type UserFormData = {
  id?: number;
  name: string;
  email: string;
  phone: string;
  level: string;
  hand: string;
  backhand: string;
  city: string;
  bio: string;
  role: string;
  suspended: number;
  is_public: number;
};

// `key` pada select/checkbox: lihat catatan di CourtForms — tanpa itu React 19 menampilkan nilai basi setelah simpan.
export function UserForm({ user, isSelf = false }: { user?: UserFormData; isSelf?: boolean }) {
  const [state, action] = useActionState(adminSaveUser, null);
  const { t } = useI18n();
  const a = t.adminX;
  const select = (name: "level" | "hand" | "backhand", label: string, values: string[]) => (
    <div>
      <label htmlFor={`u-${name}`} className="label">{label}</label>
      <select key={user?.[name]} id={`u-${name}`} name={name} defaultValue={user?.[name] ?? values[0]} className="input">
        {values.map((v) => (
          <option key={v} value={v}>{opt(t, v)}</option>
        ))}
      </select>
    </div>
  );
  return (
    <form action={action} className="space-y-6">
      {user?.id && <input type="hidden" name="userId" value={user.id} />}
      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold">{a.sectionProfile}</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="u-name" className="label">{t.account.name}</label>
            <input id="u-name" name="name" defaultValue={user?.name} required minLength={2} maxLength={60} className="input" />
          </div>
          <div>
            <label htmlFor="u-email" className="label">{t.account.email}</label>
            <input id="u-email" name="email" type="email" defaultValue={user?.email} required className="input" />
          </div>
          <div>
            <label htmlFor="u-phone" className="label">{t.account.phone}</label>
            <input id="u-phone" name="phone" type="tel" defaultValue={user?.phone} required className="input" />
          </div>
          {select("level", t.account.level, LEVELS)}
          {select("hand", t.account.hand, HANDS)}
          {select("backhand", t.account.backhand, BACKHANDS)}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="u-city" className="label">{t.account.city}</label>
            <input id="u-city" name="city" defaultValue={user?.city} maxLength={60} className="input" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="u-bio" className="label">{t.account.bio}</label>
            <input id="u-bio" name="bio" defaultValue={user?.bio} maxLength={280} className="input" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input key={user?.is_public} type="checkbox" name="is_public" defaultChecked={user ? !!user.is_public : true} className="h-4 w-4 accent-court-700" />
          {a.publicProfile}
        </label>
      </fieldset>

      <fieldset className="space-y-4 border-t border-line pt-6">
        <legend className="text-lg font-semibold">{a.sectionAccess}</legend>
        {isSelf && <p className="rounded-xl bg-sand px-3.5 py-2.5 text-xs text-muted">{a.selfNote}</p>}
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="u-role" className="label">{a.role}</label>
            <select key={user?.role} id="u-role" name="role" defaultValue={user?.role ?? "user"} disabled={isSelf} className="input disabled:bg-cream disabled:text-muted">
              <option value="user">{t.admin.users.member}</option>
              <option value="admin">{t.admin.users.admin}</option>
            </select>
            {isSelf && <input type="hidden" name="role" value="admin" />}
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="u-password" className="label">{user ? a.newPassword : t.auth.password}</label>
            <input id="u-password" name="password" type="password" autoComplete="new-password" minLength={8} required={!user} className="input" />
            <p className="mt-1 text-xs text-muted">{user ? a.newPasswordHint : t.auth.pwHint}</p>
          </div>
        </div>
        {user && !isSelf && (
          <label className="flex items-start gap-3 rounded-xl bg-clay-50 p-3.5 text-sm">
            <input key={user.suspended} type="checkbox" name="suspended" defaultChecked={!!user.suspended} className="mt-0.5 h-4 w-4 accent-clay-600" />
            <span>
              <span className="font-medium text-clay-700">{a.suspend}</span>
              <span className="block text-xs text-muted">{a.suspendHint}</span>
            </span>
          </label>
        )}
      </fieldset>

      <FormMessage state={state} />
      <SubmitButton>{user ? a.saveChanges : a.createUser}</SubmitButton>
    </form>
  );
}

export function GalleryEditForm({ item }: { item: { id: number; title: string; category: string } }) {
  const [state, action] = useActionState(updateGalleryItem, null);
  const { t } = useI18n();
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={item.id} />
      <input name="title" defaultValue={item.title} required maxLength={80} aria-label={t.admin.gallery.photoTitle} className="input px-2.5 py-1.5 text-xs" />
      <select key={item.category} name="category" defaultValue={item.category} aria-label={t.admin.gallery.category} className="input px-2.5 py-1.5 text-xs">
        {GALLERY_CATEGORIES.map((c) => (
          <option key={c} value={c}>{opt(t, c)}</option>
        ))}
      </select>
      <FormMessage state={state} />
      <SubmitButton className="btn btn-primary btn-sm w-full" pendingText="…">{t.adminX.saveChanges}</SubmitButton>
    </form>
  );
}

export type SettingsFormData = Rules & { registrationOpen: boolean; announcementId: string; announcementEn: string; contactEmail: string };

export function SettingsForm({ settings }: { settings: SettingsFormData }) {
  const [state, action] = useActionState(saveSiteSettings, null);
  const { t } = useI18n();
  const a = t.adminX;
  const rule = (key: keyof Rules, label: string) => {
    const [min, max] = RULE_BOUNDS[key];
    return (
      <div>
        <label htmlFor={`s-${key}`} className="label">{label}</label>
        <input id={`s-${key}`} name={key} type="number" min={min} max={max} defaultValue={settings[key]} required className="input" />
        <p className="mt-1 text-xs text-muted">{a.range(min, max)}</p>
      </div>
    );
  };
  return (
    <form action={action} className="space-y-6">
      <fieldset className="card space-y-4 p-6">
        <legend className="float-left mb-1 w-full text-lg font-semibold">{a.rulesTitle}</legend>
        <p className="clear-both text-xs text-muted">{a.rulesHint}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {rule("maxDaysAhead", a.fMaxDays)}
          {rule("maxDuration", a.fMaxDuration)}
          {rule("cancelLimitHours", a.fCancelLimit)}
          {rule("maxActiveBookings", a.fMaxActive)}
        </div>
      </fieldset>

      <fieldset className="card space-y-4 p-6">
        <legend className="float-left mb-1 w-full text-lg font-semibold">{a.siteTitle}</legend>
        <label className="clear-both flex items-start gap-3 text-sm">
          <input key={String(settings.registrationOpen)} type="checkbox" name="registrationOpen" defaultChecked={settings.registrationOpen} className="mt-0.5 h-4 w-4 accent-court-700" />
          <span>
            <span className="font-medium">{a.fRegistration}</span>
            <span className="block text-xs text-muted">{a.fRegistrationHint}</span>
          </span>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="s-ann-id" className="label">{a.fAnnouncementId}</label>
            <textarea id="s-ann-id" name="announcementId" defaultValue={settings.announcementId} rows={2} maxLength={300} className="input resize-none" />
          </div>
          <div>
            <label htmlFor="s-ann-en" className="label">{a.fAnnouncementEn}</label>
            <textarea id="s-ann-en" name="announcementEn" defaultValue={settings.announcementEn} rows={2} maxLength={300} className="input resize-none" />
          </div>
        </div>
        <p className="text-xs text-muted">{a.fAnnouncementHint}</p>
        <div className="sm:w-1/2">
          <label htmlFor="s-email" className="label">{a.fContactEmail}</label>
          <input id="s-email" name="contactEmail" type="email" defaultValue={settings.contactEmail} className="input" />
        </div>
      </fieldset>

      <FormMessage state={state} />
      <SubmitButton>{a.saveSettings}</SubmitButton>
    </form>
  );
}
