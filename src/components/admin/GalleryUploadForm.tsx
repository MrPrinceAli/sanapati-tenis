"use client";

import { useActionState } from "react";
import { addGalleryItem } from "@/app/actions/admin";
import { opt } from "@/lib/i18n";
import { GALLERY_CATEGORIES } from "@/lib/options";
import { useI18n } from "../I18nProvider";
import { FormMessage, SubmitButton } from "../ui";

export function GalleryUploadForm() {
  const [state, action] = useActionState(addGalleryItem, null);
  const { t } = useI18n();
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1.2fr_auto_1.2fr_auto] sm:items-end">
      <div>
        <label htmlFor="g-title" className="label">{t.admin.gallery.photoTitle}</label>
        <input id="g-title" name="title" required maxLength={80} className="input" />
      </div>
      <div>
        <label htmlFor="g-category" className="label">{t.admin.gallery.category}</label>
        <select id="g-category" name="category" className="input">
          {GALLERY_CATEGORIES.map((c) => <option key={c} value={c}>{opt(t, c)}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="g-file" className="label">{t.admin.gallery.file}</label>
        <input id="g-file" name="file" type="file" accept="image/jpeg,image/png,image/webp" required className="input py-2 file:mr-3 file:rounded-full file:border-0 file:bg-court-50 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-court-800" />
      </div>
      <SubmitButton pendingText={t.admin.gallery.uploading}>{t.admin.gallery.upload}</SubmitButton>
      <div className="sm:col-span-4">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
