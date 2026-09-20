"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { opt } from "@/lib/i18n";
import { useI18n } from "./I18nProvider";

type Item = { id: number; title: string; category: string; src: string; uploader: string };

export function GalleryGrid({ items }: { items: Item[] }) {
  const { t } = useI18n();
  // "" = semua kategori
  const categories = ["", ...Array.from(new Set(items.map((i) => i.category)))];
  const [category, setCategory] = useState("");
  const [index, setIndex] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const shown = category ? items.filter((i) => i.category === category) : items;
  const current = index === null ? null : shown[index];

  useEffect(() => {
    if (index !== null && !dialog.current?.open) dialog.current?.showModal();
  }, [index]);

  const step = (d: number) => setIndex((i) => (i === null ? i : (i + d + shown.length) % shown.length));

  return (
    <>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t.gallery.filter}>
        {categories.map((c) => (
          <button
            key={c || "all"}
            onClick={() => setCategory(c)}
            aria-pressed={category === c}
            className={`btn btn-sm ${category === c ? "btn-primary" : "btn-ghost"}`}
          >
            {c ? opt(t, c) : t.gallery.all}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="mt-10 text-muted">{t.gallery.empty}</p>
      ) : (
        <div className="mt-8 columns-2 gap-3 md:columns-3 lg:columns-4">
          {shown.map((item, i) => (
            <button
              key={item.id}
              onClick={() => setIndex(i)}
              className="group relative mb-3 block w-full cursor-zoom-in overflow-hidden rounded-2xl bg-sand"
            >
              <Image
                src={item.src}
                alt={item.title}
                width={600}
                height={600}
                loading="lazy"
                unoptimized
                className="h-auto w-full transition duration-500 group-hover:scale-105"
              />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-court-950/85 to-transparent p-3 pt-10 text-left text-cream opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                <span className="block text-[11px] font-semibold uppercase tracking-widest text-ball">{opt(t, item.category)}</span>
                <span className="text-sm font-medium">{item.title}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <dialog
        ref={dialog}
        onClose={() => setIndex(null)}
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") step(1);
          if (e.key === "ArrowLeft") step(-1);
        }}
        className="m-auto max-h-[92dvh] w-[min(56rem,calc(100vw-1.5rem))] overflow-hidden rounded-3xl bg-court-950 p-0 text-cream backdrop:bg-court-950/80 backdrop:backdrop-blur-sm"
      >
        {current && (
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.src} alt={current.title} className="max-h-[76dvh] w-full object-contain" />
            <figcaption className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-ball">{opt(t, current.category)}</p>
                <p className="truncate font-medium">{current.title}</p>
                {current.uploader && <p className="text-xs text-cream/50">{t.gallery.credit(current.uploader)}</p>}
              </div>
              <div className="flex gap-2">
                {/* Unduhan lewat rute sendiri: foto produksi ada di Vercel Blob, dan atribut `download`
                    diabaikan browser untuk tautan lintas-origin. */}
                <a
                  href={`/api/gallery/${current.id}/unduh`}
                  download
                  aria-label={t.gallery.downloadAria(current.title)}
                  className="btn btn-sm border border-cream/20 hover:bg-cream/10"
                >
                  {t.gallery.download}
                </a>
                <button className="btn btn-sm border border-cream/20 hover:bg-cream/10" onClick={() => step(-1)} aria-label={t.gallery.prev}>←</button>
                <button className="btn btn-sm border border-cream/20 hover:bg-cream/10" onClick={() => step(1)} aria-label={t.gallery.next}>→</button>
                <button className="btn btn-ball btn-sm" onClick={() => dialog.current?.close()}>{t.common.close}</button>
              </div>
            </figcaption>
          </figure>
        )}
      </dialog>
    </>
  );
}
