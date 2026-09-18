import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import { I18nProvider } from "@/components/I18nProvider";
import { getI18n } from "@/lib/i18n-server";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage" });
const instrument = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument" });

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: { default: t.meta.title, template: "%s · Sanapati Tenis" },
    description: t.meta.description,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, rules } = await getI18n();
  return (
    <html lang={locale} className={`${bricolage.variable} ${instrument.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <I18nProvider locale={locale} rules={rules}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
