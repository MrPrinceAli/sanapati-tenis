import type { Metadata } from "next";
import Image from "next/image";
import { deleteGalleryItem } from "@/app/actions/admin";
import { GalleryEditForm } from "@/components/admin/AdminForms";
import { GalleryUploadForm } from "@/components/admin/GalleryUploadForm";
import { db, type GalleryItem } from "@/lib/db";
import { opt } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n-server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.admin.tabs.gallery };
}

export default async function AdminGallery() {
  const { t } = await getI18n();
  const items = db.prepare("SELECT * FROM gallery ORDER BY id DESC").all() as GalleryItem[];
  return (
    <>
      <p className="eyebrow">{t.admin.tabs.gallery}</p>
      <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{t.admin.gallery.title}</h1>

      <section className="card mt-6 p-5">
        <GalleryUploadForm />
      </section>

      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((g) => (
          <li key={g.id} className="card overflow-hidden">
            <div className="relative aspect-square bg-sand">
              <Image src={g.src} alt={g.title} fill unoptimized sizes="240px" className="object-cover" />
            </div>
            <div className="p-3">
              <p className="truncate text-sm font-medium">{g.title}</p>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-muted">{opt(t, g.category)}</span>
                <form action={deleteGalleryItem}>
                  <input type="hidden" name="id" value={g.id} />
                  <button className="cursor-pointer text-xs font-semibold text-clay-700 hover:underline" aria-label={t.admin.gallery.deleteAria(g.title)}>
                    {t.admin.gallery.delete}
                  </button>
                </form>
              </div>
              <details className="mt-2 border-t border-line pt-2">
                <summary className="cursor-pointer text-xs font-semibold text-court-700">{t.adminX.edit}</summary>
                <div className="mt-2">
                  <GalleryEditForm item={{ id: g.id, title: g.title, category: g.category }} />
                </div>
              </details>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
