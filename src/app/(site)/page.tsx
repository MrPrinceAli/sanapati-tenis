import Image from "next/image";
import Link from "next/link";
import { getCourts, getDayBookings } from "@/lib/bookings";
import { db, type GalleryItem } from "@/lib/db";
import { getI18n } from "@/lib/i18n-server";
import { opt } from "@/lib/i18n";
import { hourRange, slotMs, todayWIB } from "@/lib/time";

export const dynamic = "force-dynamic";

function HeroCourt({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 420 520" className="h-auto w-full max-w-md" role="img" aria-label={label}>
      <rect x="10" y="10" width="400" height="500" rx="28" fill="#13503b" />
      <rect x="50" y="50" width="320" height="420" fill="#c85d34" />
      <g fill="none" stroke="#f7f3ea" strokeWidth="4">
        <rect x="70" y="70" width="280" height="380" />
        <path d="M105 70v380M315 70v380M105 160h210M105 360h210M210 160v200" />
      </g>
      <path d="M40 260h340" stroke="#f7f3ea" strokeWidth="3" strokeDasharray="2 5" />
      <circle cx="40" cy="260" r="5" fill="#f7f3ea" />
      <circle cx="380" cy="260" r="5" fill="#f7f3ea" />
      <g className="ball-bounce">
        <circle cx="262" cy="318" r="11" fill="#d8f24b" />
      </g>
      <ellipse cx="266" cy="336" rx="11" ry="4" fill="#08261c" opacity=".3" />
    </svg>
  );
}

export default async function HomePage() {
  const { t, f } = await getI18n();
  const today = todayWIB();
  const courts = getCourts();
  const bookings = getDayBookings(today);
  const now = Date.now();
  let freeToday = 0;
  for (const c of courts) {
    for (const h of hourRange(c.open_hour, c.close_hour)) {
      if (slotMs(today, h) <= now) continue;
      if (!bookings.some((b) => b.court_id === c.id && b.start_hour <= h && b.end_hour > h)) freeToday++;
    }
  }
  const openAt = Math.min(...courts.map((c) => c.open_hour));
  const closeAt = Math.max(...courts.map((c) => c.close_hour));
  const gallery = db.prepare("SELECT * FROM gallery ORDER BY id LIMIT 4").all() as GalleryItem[];

  return (
    <>
      <section className="relative overflow-hidden bg-court-900 text-cream">
        <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 h-[32rem] w-[32rem] rounded-full border-[3px] border-cream/10" />
        <div aria-hidden className="pointer-events-none absolute -bottom-52 -left-32 h-[28rem] w-[28rem] rounded-full border-[3px] border-cream/10" />
        <div className="container-page relative grid items-center gap-12 py-16 md:grid-cols-[1.15fr_1fr] md:py-24">
          <div>
            <p className="rise inline-flex items-center gap-2 rounded-full bg-cream/10 px-3.5 py-1.5 text-xs font-semibold text-ball">
              <span className="h-2 w-2 rounded-full bg-ball" />
              {freeToday > 0 ? t.home.badgeFree(freeToday) : t.home.badgeFull}
            </p>
            <h1 className="rise mt-6 text-5xl font-bold leading-[1.02] sm:text-6xl lg:text-7xl" style={{ animationDelay: "80ms" }}>
              {t.home.h1a}
              <br />
              {t.home.h1b} <span className="text-ball">{t.home.h1c}</span>
            </h1>
            <p className="rise mt-6 max-w-lg text-lg leading-relaxed text-cream/75" style={{ animationDelay: "160ms" }}>
              {t.home.lead}
            </p>
            <div className="rise mt-8 flex flex-wrap gap-3" style={{ animationDelay: "240ms" }}>
              <Link href="/booking" className="btn btn-ball px-7 py-3.5 text-base">
                {t.home.ctaBook}
              </Link>
              <Link href="#lapangan" className="btn border border-cream/25 px-7 py-3.5 text-base text-cream hover:bg-cream/10">
                {t.home.ctaCourts}
              </Link>
            </div>
            <dl className="rise mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-cream/15 pt-6" style={{ animationDelay: "320ms" }}>
              {[
                [String(courts.length), t.home.statCourts],
                [t.common.hours(closeAt - openAt), t.home.statOpen],
                [t.common.free, t.home.statFree],
              ].map(([v, l]) => (
                <div key={l}>
                  <dt className="font-display text-2xl font-bold text-cream">{v}</dt>
                  <dd className="text-xs text-cream/60">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="rise flex justify-center md:justify-end" style={{ animationDelay: "200ms" }}>
            <HeroCourt label={t.home.courtAlt} />
          </div>
        </div>
      </section>

      <section id="lapangan" className="container-page scroll-mt-20 pt-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">{t.home.courtsEyebrow}</p>
            <h2 className="mt-2 text-4xl font-bold">{t.home.courtsTitle}</h2>
          </div>
          <p className="max-w-sm text-sm text-muted">{t.home.courtsNote(f.hour(openAt), f.hour(closeAt))}</p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {courts.map((c, i) => (
            <article key={c.id} className="card group flex flex-col p-6 transition hover:-translate-y-1 hover:shadow-lg hover:shadow-court-950/5 sm:p-8">
              <div className="flex items-center justify-between">
                <span className="font-display text-5xl font-bold text-court-100 transition group-hover:text-ball-dark">0{i + 1}</span>
                <div className="flex gap-1.5">
                  <span className="badge bg-ball text-court-950">{t.common.free}</span>
                  <span className={`badge ${c.indoor ? "bg-court-900 text-cream" : "bg-clay-100 text-clay-700"}`}>
                    {c.indoor ? t.common.indoor : t.common.outdoor}
                  </span>
                </div>
              </div>
              <h3 className="mt-5 text-3xl font-semibold">{c.name}</h3>
              <p className="text-sm font-medium text-court-700">{opt(t, c.surface)}</p>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{c.description}</p>
              <div className="mt-6 border-t border-line pt-4">
                <Link href="/booking" className="text-sm font-semibold text-court-700 hover:underline">
                  {t.home.checkSchedule}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="container-page pt-24">
        <p className="eyebrow">{t.home.stepsEyebrow}</p>
        <h2 className="mt-2 text-4xl font-bold">{t.home.stepsTitle}</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {t.home.steps.map((s, i) => (
            <li key={s.title} className="rounded-2xl bg-sand p-6">
              <span className="font-display text-sm font-bold text-clay-600">0{i + 1}</span>
              <h3 className="mt-3 text-xl font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="container-page pt-24">
        <div className="grid gap-10 rounded-3xl bg-court-900 p-8 text-cream md:grid-cols-[1fr_1.4fr] md:p-12">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ball">{t.home.featEyebrow}</p>
            <h2 className="mt-2 text-4xl font-bold">{t.home.featTitle}</h2>
            <Link href="/daftar" className="btn btn-ball mt-8">
              {t.home.featCta}
            </Link>
          </div>
          <ul className="grid gap-6 sm:grid-cols-3 md:gap-8">
            {t.home.features.map((feat) => (
              <li key={feat.title} className="border-t border-cream/20 pt-4">
                <h3 className="text-lg font-semibold">{feat.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-cream/70">{feat.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container-page pt-24">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">{t.home.galEyebrow}</p>
            <h2 className="mt-2 text-4xl font-bold">{t.home.galTitle}</h2>
          </div>
          <Link href="/galeri" className="btn btn-ghost btn-sm">
            {t.home.galAll}
          </Link>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          {gallery.map((g) => (
            <Link key={g.id} href="/galeri" className="group relative aspect-[4/5] overflow-hidden rounded-2xl bg-sand">
              <Image src={g.src} alt={g.title} fill unoptimized sizes="(min-width: 768px) 25vw, 50vw" className="object-cover transition duration-500 group-hover:scale-105" />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-court-950/80 to-transparent p-3 pt-10 text-sm font-medium text-cream">{g.title}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="container-page pt-24 text-center">
        <h2 className="mx-auto max-w-2xl text-4xl font-bold sm:text-5xl">{t.home.finalTitle}</h2>
        <Link href="/booking" className="btn btn-primary mt-8 px-8 py-4 text-base">
          {t.home.finalCta}
        </Link>
      </section>
    </>
  );
}
