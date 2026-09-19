"use client";

import { useEffect, useRef } from "react";

const HEADER = 64; // tinggi header sticky (h-16)

type Props = {
  /** "pin": isi ditahan di layar selama `screens` layar scroll · "view": progres saat elemen melintasi layar. */
  mode?: "pin" | "view";
  screens?: number;
  /** Jumlah langkah diskret; langkah aktif ditulis ke atribut data-step supaya CSS bisa bereaksi. */
  steps?: number;
  className?: string;
  id?: string;
  children: React.ReactNode;
};

/**
 * Mengirim progres scroll (0..1) ke CSS lewat custom property --p. Semua animasi ada di CSS (transform/opacity),
 * jadi tidak ada re-render React saat scroll. Tanpa JS, --p tetap 0 dan halaman tampil sebagai kondisi awal.
 */
export function ScrollScene({ mode = "pin", screens = 2, steps = 0, className = "", id, children }: Props) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = (p: number) => {
      el.style.setProperty("--p", p.toFixed(4));
      if (steps) el.dataset.step = String(Math.min(steps - 1, Math.floor(p * steps)));
    };
    // Animasi dimatikan: tampilkan kondisi akhir sekali saja, tanpa listener (layout statisnya diatur di CSS).
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      apply(1);
      return;
    }

    let frame = 0;
    let visible = false;
    const measure = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = mode === "pin" ? (HEADER - rect.top) / Math.max(1, rect.height - (vh - HEADER)) : (vh - rect.top) / (vh + rect.height);
      apply(Math.min(1, Math.max(0, p)));
    };
    const onScroll = () => {
      if (visible && !frame) frame = requestAnimationFrame(measure);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) onScroll();
    });
    observer.observe(el);
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [mode, steps]);

  const style = { "--p": 0, "--n": steps || 1, ...(mode === "pin" ? { "--screens": screens } : {}) } as React.CSSProperties;
  return (
    <section ref={ref} id={id} data-step={steps ? 0 : undefined} className={`scene ${mode === "pin" ? "scene-pin" : ""} ${className}`} style={style}>
      {mode === "pin" ? <div className="scene-sticky">{children}</div> : children}
    </section>
  );
}

/** Bar progres tipis di bawah header + pemicu animasi masuk untuk elemen [data-reveal]. */
export function ScrollChrome() {
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    // Kelas ini yang mengaktifkan kondisi "tersembunyi" di CSS: tanpa JS, semua konten tetap terlihat.
    root.classList.add("reveal-ready");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            observer.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px" }
    );
    document.querySelectorAll("[data-reveal]").forEach((n) => observer.observe(n));

    let frame = 0;
    const update = () => {
      frame = 0;
      const max = root.scrollHeight - window.innerHeight;
      if (bar.current) bar.current.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      root.classList.remove("reveal-ready");
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-16 z-30 h-0.5">
      <div ref={bar} className="h-full origin-left bg-ball-dark" style={{ transform: "scaleX(0)" }} />
    </div>
  );
}
