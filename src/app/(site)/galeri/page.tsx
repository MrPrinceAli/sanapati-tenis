import type { Metadata } from "next";
import { GalleryContribute } from "@/components/GalleryContribute";
import { GalleryGrid } from "@/components/GalleryGrid";
import { db, type GalleryItem } from "@/lib/db";
import { getI18n } from "@/lib/i18n-server";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.gallery.metaTitle };
}
export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const [{ t }, settings, items] = await Promise.all([
    getI18n(),
    getSettings(),
    // Hanya foto berstatus 'approved'. Kiriman pengunjung menunggu persetujuan admin dulu.
    db.all<GalleryItem>("SELECT id, title, category, src, uploader FROM gallery WHERE status = 'approved' ORDER BY id DESC"),
  ]);
  return (
    <div className="container-page pt-10">
      <p className="eyebrow">{t.gallery.eyebrow}</p>
      <h1 className="mt-2 text-4xl font-bold sm:text-5xl">{t.gallery.title}</h1>
      <p className="mt-3 max-w-xl text-muted">{t.gallery.lead}</p>
      <div className="mt-8">
        <GalleryGrid items={items.map(({ id, title, category, src, uploader }) => ({ id, title, category, src, uploader }))} />
      </div>
      {settings.publicUploads ? (
        <GalleryContribute />
      ) : (
        <p className="mt-16 text-sm text-muted">{t.gallery.closed}</p>
      )}
    </div>
  );
}
