import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE, formatters, getDict, isLocale, type Locale } from "./i18n";
import { getRules } from "./settings";

export const getLocale = cache(async (): Promise<Locale> => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
});

export async function getI18n() {
  const locale = await getLocale();
  const rules = getRules();
  return { locale, rules, t: getDict(locale, rules), f: formatters(locale) };
}
