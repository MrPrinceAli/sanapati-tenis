import type { Metadata } from "next";
import { GalleryGrid } from "@/components/GalleryGrid";
import { db, type GalleryItem } from "@/lib/db";
import { getI18n } from "@/lib/i18n-server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.gallery.metaTitle };
}
export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const { t } = await getI18n();
  const items = await db.all("SELECT id, title, category, src FROM gallery ORDER BY id DESC") as GalleryItem[];
  return (
    <div className="container-page pt-10">
      <p className="eyebrow">{t.gallery.eyebrow}</p>
      <h1 className="mt-2 text-4xl font-bold sm:text-5xl">{t.gallery.title}</h1>
      <p className="mt-3 max-w-xl text-muted">{t.gallery.lead}</p>
      <div className="mt-8">
        <GalleryGrid items={items.map(({ id, title, category, src }) => ({ id, title, category, src }))} />
      </div>
    </div>
  );
}
