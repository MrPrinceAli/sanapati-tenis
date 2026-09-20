import Image from "next/image";
import Link from "next/link";
import { ScrollChrome, ScrollScene } from "@/components/landing/ScrollScene";
import { getCourts, getDayBookings } from "@/lib/bookings";
import { db, type GalleryItem } from "@/lib/db";
import { opt } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n-server";
import { addDays, hourRange, slotMs, todayWIB } from "@/lib/time";

export const dynamic = "force-dynamic";

function Ball({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden>
      <circle cx="16" cy="16" r="15" fill="#d8f24b" />
      <path d="M5 6.5c6 4 6 15 0 19M27 6.5c-6 4-6 15 0 19" fill="none" stroke="#f7f3ea" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// Lapangan tampak atas (lanskap). pathLength=1 supaya garis bisa "digambar" lewat stroke-dashoffset dari CSS.
function HeroCourt() {
  const line = { pathLength: 1, className: "draw", fill: "none", stroke: "#f7f3ea", strokeWidth: 5, strokeLinecap: "square" as const };
  return (
    <svg viewBox="0 0 1000 560" aria-hidden>
      <rect width="1000" height="560" rx="36" fill="#13503b" />
      <rect x="80" y="60" width="840" height="440" fill="#c85d34" />
      <rect x="80" y="60" width="840" height="440" {...line} />
      <path d="M80 115H920M80 445H920" {...line} />
      <path d="M290 115V445M710 115V445" {...line} />
      <path d="M290 280H710" {...line} />
      <path d="M500 38V522" {...line} strokeWidth={3} />
      <circle cx="500" cy="38" r="7" fill="#f7f3ea" />
      <circle cx="500" cy="522" r="7" fill="#f7f3ea" />
    </svg>
  );
}

export default async function HomePage() {
  const { t, f } = await getI18n();
  const h = t.home;
  const today = todayWIB();
  const courts = await getCourts();
  const bookings = await getDayBookings(today);
  const now = Date.now();
  let freeToday = 0;
  for (const c of courts) {
    for (const hour of hourRange(c.open_hour, c.close_hour)) {
      if (slotMs(today, hour) <= now) continue;
      if (!bookings.some((b) => b.court_id === c.id && b.start_hour <= hour && b.end_hour > hour)) freeToday++;
    }
  }
  const openAt = courts.length ? Math.min(...courts.map((c) => c.open_hour)) : 6;
  const closeAt = courts.length ? Math.max(...courts.map((c) => c.close_hour)) : 23;
  // Hanya foto yang sudah disetujui: kiriman pengunjung tidak boleh tampil di beranda sebelum diperiksa admin.
  const gallery = await db.all("SELECT * FROM gallery WHERE status = 'approved' ORDER BY id LIMIT 4") as GalleryItem[];

  // Mockup papan booking di adegan "cara booking": pakai tanggal & nama lapangan sungguhan.
  const mockDates = Array.from({ length: 5 }, (_, i) => addDays(today, i));
  const mockCourts = (courts.length ? courts : [{ id: 0, name: h.courtsEyebrow }]).slice(0, 2);
  const mockHours = [6, 7, 8, 9, 10];
  const taken = new Set(["1-6", "0-10", "1-9"]);
  const panels = courts.length + 1;

  return (
    <>
      <ScrollChrome />

      {/* ---------- 1. HERO: kamera terbang ke atas lapangan ---------- */}
      <ScrollScene screens={2.3} steps={2} className="bg-court-900 text-cream">
        <div className="hero-court">
          <HeroCourt />
        </div>
        <div className="hero-scrim absolute inset-0" aria-hidden />
        <div className="hero-ball">
          <Ball size={34} />
        </div>

        <div className="hero-copy container-page relative flex h-full flex-col justify-center pb-10">
          <p className="rise inline-flex w-fit items-center gap-2 rounded-full bg-cream/10 px-3.5 py-1.5 text-xs font-semibold text-ball backdrop-blur-sm">
            <span className="h-2 w-2 rounded-full bg-ball" />
            {freeToday > 0 ? h.badgeFree(freeToday) : h.badgeFull}
          </p>
          <h1 className="rise mt-6 text-[clamp(2.75rem,8.5vw,7rem)] font-bold leading-[0.98]" style={{ animationDelay: "80ms" }}>
            {h.h1a}
            <br />
            {h.h1b} <span className="text-ball">{h.h1c}</span>
          </h1>
          <p className="rise mt-6 max-w-lg text-lg leading-relaxed text-cream/80" style={{ animationDelay: "160ms" }}>
            {h.lead}
          </p>
          <div className="rise mt-8 flex flex-wrap gap-3" style={{ animationDelay: "240ms" }}>
            <Link href="/booking" className="btn btn-ball px-7 py-3.5 text-base">
              {h.ctaBook}
            </Link>
            <Link href="#lapangan" className="btn border border-cream/30 px-7 py-3.5 text-base text-cream backdrop-blur-sm hover:bg-cream/10">
              {h.ctaCourts}
            </Link>
          </div>
        </div>

        <div className="hero-next container-page absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="font-display text-[clamp(2.25rem,7vw,5.5rem)] font-bold leading-[1.05]">
            {h.heroNext.map((line, i) => (
              <span key={line} className={`block ${i === h.heroNext.length - 1 ? "text-ball" : ""}`}>
                {line}
              </span>
            ))}
          </p>
          <dl className="mt-10 grid grid-cols-3 gap-6 rounded-2xl bg-court-950/60 px-6 py-4 backdrop-blur-sm sm:gap-12 sm:px-10">
            {[
              [String(courts.length), h.statCourts],
              [t.common.hours(closeAt - openAt), h.statOpen],
              [t.common.free, h.statFree],
            ].map(([v, l]) => (
              <div key={l}>
                <dt className="font-display text-2xl font-bold sm:text-3xl">{v}</dt>
                <dd className="text-xs text-cream/70">{l}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="hero-hint absolute inset-x-0 bottom-5 flex flex-col items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-cream/70" aria-hidden>
          {h.scrollHint}
          <span className="ball-bounce block h-6 w-px bg-cream/60" />
        </p>
      </ScrollScene>

      {/* ---------- 2. CARA BOOKING: tiga langkah, mockup ikut hidup ---------- */}
      <ScrollScene screens={3.2} steps={3} className="bg-cream">
        <div className="container-page grid h-full content-center items-center gap-4 py-4 md:grid-cols-[1fr_1.05fr] md:gap-14 md:py-6">
          <div>
            <p className="eyebrow">{h.stepsEyebrow}</p>
            <h2 className="mt-1 text-2xl font-bold sm:text-5xl md:mt-2">{h.stepsTitle}</h2>
            <div className="relative mt-3 pl-5 md:mt-10 md:pl-6">
              <span className="absolute left-0 top-0 h-full w-0.5 rounded bg-line" aria-hidden>
                <span className="step-rail-fill block h-full w-full rounded bg-court-900" />
              </span>
              <ol className="space-y-3 md:space-y-7">
                {h.steps.map((s, i) => (
                  <li key={s.title} data-i={i} className="step-item">
                    <span className="font-display text-sm font-bold text-clay-600">0{i + 1}</span>
                    <h3 className="text-lg font-semibold sm:text-2xl">{s.title}</h3>
                    <p className="mt-1 hidden max-w-md text-sm leading-relaxed text-muted sm:block">{s.body}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="card relative overflow-hidden p-3 pb-[8.5rem] shadow-2xl shadow-court-950/10 sm:p-5 sm:pb-[7.25rem]" aria-hidden>
            <div className="flex gap-1.5">
              {mockDates.map((d, i) => (
                <span key={d} className={`mock-date flex flex-1 flex-col items-center rounded-xl border border-line py-1.5 text-[10px] font-semibold uppercase text-muted ${i === 1 ? "is-target" : ""}`}>
                  {i === 0 ? t.common.today : f.weekday(d)}
                  <span className="font-display text-base font-bold normal-case">{f.dayNum(d)}</span>
                </span>
              ))}
            </div>
            <div className="mt-3 grid gap-1.5" style={{ gridTemplateColumns: `2.4rem repeat(${mockCourts.length}, 1fr)` }}>
              <span />
              {mockCourts.map((c) => (
                <span key={c.id} className="truncate pb-1 text-center text-xs font-semibold">
                  {c.name}
                </span>
              ))}
              {mockHours.map((hour) => (
                <div key={hour} className={hour > 8 ? "contents max-md:hidden" : "contents"}>
                  <span className="flex items-center justify-end pr-1 text-[11px] tabular-nums text-muted">{f.hour(hour)}</span>
                  {mockCourts.map((c, ci) => {
                    const isTaken = taken.has(`${ci}-${hour}`);
                    const isTarget = ci === 0 && (hour === 7 || hour === 8);
                    return (
                      <span
                        key={c.id}
                        className={`mock-slot flex h-8 items-center justify-center rounded-lg border text-[11px] font-semibold sm:h-10 ${
                          isTaken ? "border-transparent bg-sand text-muted" : "border-court-200 bg-court-50 text-court-800"
                        } ${isTarget ? "is-target" : ""}`}
                      >
                        {isTaken ? (
                          t.schedule.taken
                        ) : isTarget ? (
                          <>
                            <span className="when-0">{t.schedule.free}</span>
                            <span className="when-1">✓</span>
                            <span className="when-2">{t.schedule.mine}</span>
                          </>
                        ) : (
                          t.schedule.free
                        )}
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
            {/* Tempat ringkasan: kosong dulu, lalu tiket konfirmasi meluncur masuk menutupinya di langkah 3. */}
            <p className="absolute inset-x-3 bottom-3 flex h-[7.25rem] items-center justify-center rounded-2xl border border-dashed border-line text-xs text-muted sm:inset-x-5 sm:bottom-5 sm:h-[5.25rem]">
              {t.schedule.summary}
            </p>
            <div className="mock-ticket absolute inset-x-3 bottom-3 rounded-2xl bg-court-900 p-4 text-cream shadow-xl sm:inset-x-5 sm:bottom-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-ball">{t.my.successEyebrow}</p>
              <p className="mt-1 font-display text-lg font-semibold">
                {mockCourts[0].name} · {f.range(7, 9)}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center justify-between gap-2 text-xs text-cream/70">
                <span>
                  {t.my.codeLabel} <span className="font-mono font-semibold text-cream">SNP-7K2QXM</span>
                </span>
                <span>🔔 {h.mockReminder}</span>
              </p>
            </div>
          </div>
        </div>
      </ScrollScene>

      {/* ---------- 3. LAPANGAN: scroll vertikal → geser horizontal ---------- */}
      <ScrollScene id="lapangan" screens={panels * 0.9 + 0.5} steps={panels} className="scroll-mt-16">
        <div className="h-track">
          <div className="h-panel flex items-center bg-sand">
            <div className="container-page">
              <p className="eyebrow">{h.courtsEyebrow}</p>
              <h2 className="mt-2 max-w-3xl text-[clamp(2.5rem,7vw,6rem)] font-bold leading-none">{h.courtsTitle}</h2>
              <p className="mt-6 max-w-md text-lg text-muted">{h.courtsNote(f.hour(openAt), f.hour(closeAt))}</p>
              <p className="mt-10 text-xs font-semibold uppercase tracking-[0.2em] text-clay-600">{h.keepScrolling} →</p>
            </div>
          </div>
          {courts.map((c, i) => (
            <article key={c.id} className={`h-panel relative flex items-center overflow-hidden text-cream ${i % 2 ? "bg-clay-600" : "bg-court-900"}`}>
              <span aria-hidden className="pointer-events-none absolute -right-6 -top-10 font-display text-[clamp(14rem,38vw,34rem)] font-bold leading-none text-cream/[0.06]">
                0{i + 1}
              </span>
              <div className="container-page relative">
                <div className="flex flex-wrap gap-1.5">
                  <span className="badge bg-ball text-court-950">{t.common.free}</span>
                  <span className="badge bg-cream/15">{opt(t, c.surface)}</span>
                  <span className="badge bg-cream/15">{c.indoor ? t.common.indoor : t.common.outdoor}</span>
                  <span className="badge bg-cream/15">{t.calendar.openHours(f.hour(c.open_hour), f.hour(c.close_hour))}</span>
                </div>
                <h3 className="mt-5 text-[clamp(3.25rem,13vw,11rem)] font-bold leading-[0.9]">{c.name}</h3>
                <p className="mt-6 max-w-md text-lg text-cream/80">{c.description}</p>
                <Link href="/booking" className="btn btn-ball mt-8 px-7 py-3.5 text-base">
                  {h.checkSchedule}
                </Link>
              </div>
            </article>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-ink/10" aria-hidden>
          <div className="h-progress h-full bg-ball" />
        </div>
      </ScrollScene>

      {/* ---------- 4. FITUR ---------- */}
      <section className="container-page py-24 sm:py-32">
        <div className="max-w-2xl" data-reveal>
          <p className="eyebrow">{h.featEyebrow}</p>
          <h2 className="mt-2 text-4xl font-bold sm:text-6xl">{h.featTitle}</h2>
        </div>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {h.features.map((feat, i) => (
            <li key={feat.title} data-reveal style={{ "--d": i } as React.CSSProperties} className={`flex flex-col rounded-3xl p-6 ${i === 3 ? "bg-court-900 text-cream" : "bg-sand"}`}>
              <span className={`font-display text-sm font-bold ${i === 3 ? "text-ball" : "text-clay-600"}`}>0{i + 1}</span>
              <h3 className="mt-8 text-xl font-semibold">{feat.title}</h3>
              <p className={`mt-2 flex-1 text-sm leading-relaxed ${i === 3 ? "text-cream/75" : "text-muted"}`}>{feat.body}</p>
              {i === 3 && (
                <Link href="/mabar" className="mt-5 text-sm font-semibold text-ball hover:underline">
                  {h.seeMabar}
                </Link>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-10" data-reveal>
          <Link href="/daftar" className="btn btn-primary px-7 py-3.5 text-base">
            {h.featCta}
          </Link>
        </div>
      </section>

      {/* ---------- 5. GALERI: parallax beda kecepatan ---------- */}
      <ScrollScene mode="view" className="overflow-hidden bg-court-950 py-28 text-cream sm:py-40">
        <div className="container-page">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ball">{h.galEyebrow}</p>
              <h2 className="mt-2 text-4xl font-bold sm:text-6xl">{h.galTitle}</h2>
            </div>
            <Link href="/galeri" className="btn btn-sm border border-cream/25 text-cream hover:bg-cream/10">
              {h.galAll}
            </Link>
          </div>
          <div className="mt-16 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
            {gallery.map((g, i) => (
              <Link
                key={g.id}
                href="/galeri"
                className="parallax group relative aspect-[3/4] overflow-hidden rounded-2xl bg-court-800"
                style={{ "--speed": `${[-150, 110, -70, 140][i % 4]}px` } as React.CSSProperties}
              >
                <Image src={g.src} alt={g.title} fill unoptimized sizes="(min-width: 768px) 25vw, 50vw" className="object-cover transition duration-700 group-hover:scale-105" />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-court-950/85 to-transparent p-3 pt-12 text-sm font-medium">{g.title}</span>
              </Link>
            ))}
          </div>
        </div>
      </ScrollScene>

      {/* ---------- 6. CTA: bola menggelinding ---------- */}
      <ScrollScene mode="view" className="-mb-24 overflow-hidden bg-ball py-28 text-center text-court-950 sm:py-40">
        <div className="container-page">
          <h2 className="mx-auto max-w-4xl text-[clamp(2.25rem,7vw,5.5rem)] font-bold leading-[1.02]">{h.finalTitle}</h2>
          <Link href="/booking" className="btn btn-primary mt-10 px-9 py-4 text-base">
            {h.finalCta}
          </Link>
        </div>
        <div className="mt-16 border-t-2 border-court-950/15" aria-hidden>
          <div className="cta-ball -mt-[23px] inline-block">
            <svg width="44" height="44" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="15" fill="#0e3b2c" />
              <path d="M5 6.5c6 4 6 15 0 19M27 6.5c-6 4-6 15 0 19" fill="none" stroke="#d8f24b" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </ScrollScene>
    </>
  );
}
