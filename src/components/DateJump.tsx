"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "./I18nProvider";

export function DateJump({ value, min, max }: { value: string; min: string; max: string }) {
  const router = useRouter();
  const { t } = useI18n();
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      {t.schedule.jump}
      <input
        type="date"
        className="input w-auto py-2"
        value={value}
        min={min}
        max={max}
        onChange={(e) => e.target.value && router.push(`/booking?tanggal=${e.target.value}`, { scroll: false })}
      />
    </label>
  );
}
