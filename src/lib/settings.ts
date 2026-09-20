import "server-only";
import { cache } from "react";
import { db } from "./db";
import { DEFAULT_RULES, RULE_BOUNDS, type Rules } from "./rules";

export type SiteSettings = Rules & {
  registrationOpen: boolean;
  /** Pengunjung tanpa akun boleh mengirim foto ke galeri (tetap lewat antrean persetujuan admin). */
  publicUploads: boolean;
  announcementId: string;
  announcementEn: string;
  contactEmail: string;
};

const DEFAULTS: SiteSettings = {
  ...DEFAULT_RULES,
  registrationOpen: true,
  publicUploads: true,
  announcementId: "",
  announcementEn: "",
  contactEmail: "halo@sanapati.id",
};

// Dibaca sekali per request. Nilai yang rusak/di luar batas jatuh kembali ke default, bukan membuat situs error.
export const getSettings = cache(async (): Promise<SiteSettings> => {
  const rows = await db.all<{ key: string; value: string }>("SELECT key, value FROM settings");
  const stored = new Map(rows.map((r) => [r.key, r.value]));
  const out = { ...DEFAULTS };
  for (const key of Object.keys(RULE_BOUNDS) as (keyof Rules)[]) {
    const n = Number(stored.get(key));
    const [min, max] = RULE_BOUNDS[key];
    if (stored.has(key) && Number.isInteger(n) && n >= min && n <= max) out[key] = n;
  }
  for (const key of ["registrationOpen", "publicUploads"] as const) {
    if (stored.has(key)) out[key] = stored.get(key) === "1";
  }
  for (const key of ["announcementId", "announcementEn", "contactEmail"] as const) {
    if (stored.has(key)) out[key] = stored.get(key)!;
  }
  return out;
});

export async function getRules(): Promise<Rules> {
  const { maxDaysAhead, maxDuration, cancelLimitHours, maxActiveBookings } = await getSettings();
  return { maxDaysAhead, maxDuration, cancelLimitHours, maxActiveBookings };
}

export const saveSettings = (values: SiteSettings) =>
  db.batch(
    Object.entries(values).map(([key, value]) => ({
      sql: "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      args: [key, typeof value === "boolean" ? (value ? "1" : "0") : String(value)],
    }))
  );
