import Link from "next/link";
import { Logo } from "@/components/NavBar";
import { getCourts } from "@/lib/bookings";
import { getI18n } from "@/lib/i18n-server";
import { getSettings } from "@/lib/settings";
import { CLOSE_HOUR as DEFAULT_CLOSE, OPEN_HOUR as DEFAULT_OPEN } from "@/lib/time";

/**
 * Footer situs. Dipakai layout (site) dan juga halaman 404 di root — halaman 404 untuk URL
 * yang tidak cocok dengan rute mana pun dirender di luar layout (site), jadi tanpa komponen
 * ini halaman itu tampil tanpa navigasi dan footer sama sekali.
 */
export async function SiteFooter() {
  const [{ t, f }, settings, courts] = await Promise.all([getI18n(), getSettings(), getCourts()]);
  // Jam di footer diringkas dari lapangan yang aktif. Tanpa lapangan aktif, Math.min/max atas array kosong
  // menghasilkan Infinity — jadi jatuh ke jam default, bukan "Infinity.00".
  const OPEN_HOUR = courts.length ? Math.min(...courts.map((c) => c.open_hour)) : DEFAULT_OPEN;
  const CLOSE_HOUR = courts.length ? Math.max(...courts.map((c) => c.close_hour)) : DEFAULT_CLOSE;
  return (
    <footer className="mt-24 bg-court-950 text-cream/80">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <Logo light />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-cream/60">{t.footer.about}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ball">{t.footer.explore}</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link href="/booking" className="hover:text-ball">{t.nav.schedule}</Link></li>
            <li><Link href="/jadwal" className="hover:text-ball">{t.nav.calendar}</Link></li>
            <li><Link href="/mabar" className="hover:text-ball">{t.mabar.nav}</Link></li>
            <li><Link href="/galeri" className="hover:text-ball">{t.nav.gallery}</Link></li>
            <li><Link href="/pemain" className="hover:text-ball">{t.footer.directory}</Link></li>
            <li><Link href="/booking-saya" className="hover:text-ball">{t.nav.myBookings}</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ball">{t.footer.visit}</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>{t.footer.daily(f.hour(OPEN_HOUR), f.hour(CLOSE_HOUR))}</li>
            {settings.contactEmail && <li>{settings.contactEmail}</li>}
          </ul>
        </div>
      </div>
      {/* Hak cipta milik klub pemakai; kredit pembuat ditulis terpisah supaya jelas siapa yang mengelola dan siapa yang membuat. */}
      <div className="border-t border-cream/10">
        <div className="container-page flex flex-col items-center justify-between gap-1.5 py-5 text-xs text-cream/40 sm:flex-row">
          <p>© {new Date().getFullYear()} Sanapati Tenis Club</p>
          <p>
            {t.footer.madeBy} <span className="font-semibold text-cream/70">Ali</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
