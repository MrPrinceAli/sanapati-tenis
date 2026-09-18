"use client";

import { useState } from "react";

export type BarDatum = { key: string; label: string; longLabel: string; value: number };

function niceMax(max: number): number {
  if (max <= 4) return 4;
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const candidates = [1, 2, 2.5, 5, 10].map((m) => m * step);
  const tick = candidates.find((c) => max / c <= 4) ?? step * 10;
  return Math.ceil(max / tick) * tick;
}

// Satu seri, satu warna: judul kartu yang menamai seri, jadi tidak perlu legend.
export function BarChart({ data, unit, tableLabel }: { data: BarDatum[]; unit: string; tableLabel: string }) {
  const [active, setActive] = useState<number | null>(null);
  const top = niceMax(Math.max(...data.map((d) => d.value), 0));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => top * t);

  return (
    <div>
      <div className="flex gap-2">
        <div className="relative h-44 w-6 text-[11px] tabular-nums text-muted" aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 translate-y-1/2 leading-none" style={{ bottom: `${(t / top) * 100}%` }}>
              {Number.isInteger(t) ? t : ""}
            </span>
          ))}
        </div>
        <div className="relative h-44 flex-1">
          {ticks.map((t) => (
            <span
              key={t}
              aria-hidden
              className={`absolute inset-x-0 h-px ${t === 0 ? "bg-line" : "bg-line/50"}`}
              style={{ bottom: `${(t / top) * 100}%` }}
            />
          ))}
          <div className="absolute inset-0 flex" onMouseLeave={() => setActive(null)}>
            {data.map((d, i) => (
              <div
                key={d.key}
                tabIndex={0}
                role="img"
                aria-label={`${d.longLabel}: ${d.value} ${unit}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="relative flex flex-1 items-end justify-center px-[1px] outline-none"
              >
                {active === i && <span className="absolute inset-y-0 w-full rounded bg-court-50" aria-hidden />}
                <span
                  className={`relative w-full max-w-6 rounded-t-[4px] transition-colors ${active === i ? "bg-court-900" : "bg-court-700"}`}
                  style={{ height: `${(d.value / top) * 100}%`, minHeight: d.value > 0 ? 2 : 0 }}
                />
                {active === i && (
                  <div
                    className={`pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs text-cream shadow-lg ${
                      i < 2 ? "left-0" : i > data.length - 3 ? "right-0" : ""
                    }`}
                  >
                    <span className="block text-cream/70">{d.longLabel}</span>
                    <span className="font-semibold tabular-nums">
                      {d.value} {unit}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="ml-6 mt-1.5 flex pl-2 text-[11px] text-muted" aria-hidden>
        {data.map((d, i) => (
          <span key={d.key} className="flex-1 text-center">
            {i % 2 === (data.length - 1) % 2 ? d.label : ""}
          </span>
        ))}
      </div>
      <details className="mt-3 text-xs text-muted">
        <summary className="cursor-pointer font-medium hover:text-ink">{tableLabel}</summary>
        <table className="mt-2 w-full max-w-xs text-left tabular-nums">
          <tbody>
            {data.map((d) => (
              <tr key={d.key} className="border-t border-line">
                <th scope="row" className="py-1 font-normal">{d.longLabel}</th>
                <td className="py-1 text-right text-ink">{d.value} {unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
