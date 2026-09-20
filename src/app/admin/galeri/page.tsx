import type { Metadata } from "next";
import Image from "next/image";
import { approveGalleryItem, deleteGalleryItem } from "@/app/actions/admin";
import { GalleryEditForm } from "@/components/admin/AdminForms";
import { GalleryUploadForm } from "@/components/admin/GalleryUploadForm";
import { db, type GalleryItem } from "@/lib/db";
import { opt } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n-server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.admin.tabs.gallery };
}

function PhotoCard({ g, children }: { g: GalleryItem; children: React.ReactNode }) {
  return (
    <li className="card overflow-hidden">
      <div className="relative aspect-square bg-sand">
        <Image src={g.src} alt={g.title} fill unoptimized sizes="240px" className="object-cover" />
      </div>
      <div className="p-3">
        <p className="truncate text-sm font-medium">{g.title}</p>
        {children}
      </div>
    </li>
  );
}

export default async function AdminGallery() {
  const { t } = await getI18n();
  const g = t.admin.gallery;
  const items = await db.all<GalleryItem>("SELECT * FROM gallery ORDER BY id DESC");
  // Kiriman pengunjung ditaruh paling atas — itu yang butuh tindakan admin.
  const pending = items.filter((i) => i.status === "pending");
  const approved = items.filter((i) => i.status !== "pending");

  return (
    <>
      <p className="eyebrow">{t.admin.tabs.gallery}</p>
      <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{g.title}</h1>

      <section className="card mt-6 p-5">
        <GalleryUploadForm />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">{g.pendingTitle(pending.length)}</h2>
        <p className="mt-1 text-sm text-muted">{g.pendingLead}</p>
        {pending.length === 0 ? (
          <p className="mt-4 text-sm text-muted">{g.pendingNone}</p>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {pending.map((item) => (
              <PhotoCard key={item.id} g={item}>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {opt(t, item.category)} · {item.uploader || g.fromAnon}
                </p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <form action={approveGalleryItem}>
                    <input type="hidden" name="id" value={item.id} />
                    <button className="btn btn-primary btn-sm" aria-label={g.approveAria(item.title)}>
                      {g.approve}
                    </button>
                  </form>
                  <form action={deleteGalleryItem}>
                    <input type="hidden" name="id" value={item.id} />
                    <button className="cursor-pointer text-xs font-semibold text-clay-700 hover:underline" aria-label={g.deleteAria(item.title)}>
                      {g.delete}
                    </button>
                  </form>
                </div>
              </PhotoCard>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">{g.published(approved.length)}</h2>
        {approved.length === 0 ? (
          <p className="mt-4 text-sm text-muted">{g.empty}</p>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {approved.map((item) => (
              <PhotoCard key={item.id} g={item}>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs text-muted">{opt(t, item.category)}</span>
                  <form action={deleteGalleryItem}>
                    <input type="hidden" name="id" value={item.id} />
                    <button className="cursor-pointer text-xs font-semibold text-clay-700 hover:underline" aria-label={g.deleteAria(item.title)}>
                      {g.delete}
                    </button>
                  </form>
                </div>
                <details className="mt-2 border-t border-line pt-2">
                  <summary className="cursor-pointer text-xs font-semibold text-court-700">{t.adminX.edit}</summary>
                  <div className="mt-2">
                    <GalleryEditForm item={{ id: item.id, title: item.title, category: item.category }} />
                  </div>
                </details>
              </PhotoCard>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
