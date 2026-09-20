"use client";

import { useActionState } from "react";
import { submitGalleryPhoto } from "@/app/actions/gallery";
import { opt } from "@/lib/i18n";
import { GALLERY_CATEGORIES } from "@/lib/options";
import { useI18n } from "./I18nProvider";
import { FormMessage, SubmitButton } from "./ui";

/**
 * Formulir kirim foto untuk pengunjung — tidak perlu akun.
 * Foto masuk antrean persetujuan admin, tidak langsung tampil (lihat actions/gallery.ts).
 */
export function GalleryContribute() {
  const [state, action] = useActionState(submitGalleryPhoto, null);
  const { t } = useI18n();
  const v = state?.values ?? {};
  return (
    <section className="card mt-16 p-6 sm:p-8">
      <h2 className="text-xl font-semibold">{t.gallery.contribute}</h2>
      <p className="mt-1.5 max-w-lg text-sm text-muted">{t.gallery.contributeLead}</p>
      <form action={action} className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="c-file" className="label">{t.admin.gallery.file}</label>
          <input
            id="c-file"
            name="file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            className="input py-2 file:mr-3 file:rounded-full file:border-0 file:bg-court-50 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-court-800"
          />
        </div>
        <div>
          <label htmlFor="c-title" className="label">{t.gallery.photoTitle}</label>
          <input
            id="c-title"
            name="title"
            maxLength={80}
            defaultValue={v.title ?? ""}
            placeholder={t.gallery.photoTitlePlaceholder}
            className="input"
          />
        </div>
        <div>
          <label htmlFor="c-category" className="label">{t.admin.gallery.category}</label>
          <select key={v.category} id="c-category" name="category" defaultValue={v.category ?? GALLERY_CATEGORIES[0]} className="input">
            {GALLERY_CATEGORIES.map((c) => (
              <option key={c} value={c}>{opt(t, c)}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2 sm:w-1/2 sm:pr-2">
          <label htmlFor="c-uploader" className="label">{t.gallery.yourName}</label>
          <input
            id="c-uploader"
            name="uploader"
            maxLength={40}
            defaultValue={v.uploader ?? ""}
            placeholder={t.gallery.yourNamePlaceholder}
            className="input"
          />
        </div>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-4">
          <SubmitButton pendingText={t.gallery.sending}>{t.gallery.send}</SubmitButton>
          <div className="min-w-0 flex-1">
            <FormMessage state={state} />
          </div>
        </div>
      </form>
    </section>
  );
}
