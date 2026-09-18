"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "../I18nProvider";

export function AdminNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  const TABS = [
    { href: "/admin", label: t.admin.tabs.overview },
    { href: "/admin/booking", label: t.admin.tabs.bookings },
    { href: "/admin/lapangan", label: t.admin.tabs.courts },
    { href: "/admin/galeri", label: t.admin.tabs.gallery },
    { href: "/admin/pengguna", label: t.admin.tabs.users },
    { href: "/admin/mabar", label: t.adminX.tabMabar },
    { href: "/admin/pengaturan", label: t.adminX.tabSettings },
  ];
  return (
    <nav aria-label={t.admin.navLabel} className="-mb-px flex gap-1 overflow-x-auto">
      {TABS.map((tab) => {
        const active = tab.href === "/admin" ? pathname === "/admin" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 border-b-2 px-3.5 py-3 text-sm font-medium transition ${
              active ? "border-ball text-cream" : "border-transparent text-cream/60 hover:text-cream"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
