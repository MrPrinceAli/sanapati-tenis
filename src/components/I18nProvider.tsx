"use client";

import { createContext, useContext, useMemo, useTransition } from "react";
import { setLocale } from "@/app/actions/locale";
import { DEFAULT_LOCALE, formatters, getDict, type Locale } from "@/lib/i18n";
import { DEFAULT_RULES, type Rules } from "@/lib/rules";

const I18nContext = createContext<{ locale: Locale; rules: Rules }>({ locale: DEFAULT_LOCALE, rules: DEFAULT_RULES });

// `rules` ikut dikirim dari server supaya teks dan validasi di client memakai aturan yang sama dengan server.
export function I18nProvider({ locale, rules, children }: { locale: Locale; rules: Rules; children: React.ReactNode }) {
  // `rules` adalah objek baru di tiap render server; pecah ke nilai primitif supaya konteks tidak berubah tanpa sebab.
  const { maxDaysAhead, maxDuration, cancelLimitHours, maxActiveBookings } = rules;
  const value = useMemo(
    () => ({ locale, rules: { maxDaysAhead, maxDuration, cancelLimitHours, maxActiveBookings } }),
    [locale, maxDaysAhead, maxDuration, cancelLimitHours, maxActiveBookings]
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const { locale, rules } = useContext(I18nContext);
  return useMemo(() => ({ locale, rules, t: getDict(locale, rules), f: formatters(locale) }), [locale, rules]);
}

export function LanguageSwitch({ light = false }: { light?: boolean }) {
  const { locale, t } = useI18n();
  const [pending, start] = useTransition();
  const next: Locale = locale === "id" ? "en" : "id";
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => setLocale(next))}
      aria-label={t.nav.switchTo}
      title={t.nav.switchTo}
      className={`flex h-10 cursor-pointer items-center gap-1 rounded-full border px-3 text-xs font-semibold transition disabled:opacity-60 ${
        light ? "border-cream/20 text-cream hover:bg-cream/10" : "border-line bg-white hover:border-court-700"
      }`}
    >
      <span className={locale === "id" ? "" : "opacity-40"}>ID</span>
      <span className="opacity-30">/</span>
      <span className={locale === "en" ? "" : "opacity-40"}>EN</span>
    </button>
  );
}
