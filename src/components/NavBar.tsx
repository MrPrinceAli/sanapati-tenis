"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/app/actions/auth";
import { Avatar } from "./Avatar";
import { LanguageSwitch, useI18n } from "./I18nProvider";
import { ReminderBell } from "./ReminderBell";

export type NavUser = { id: number; name: string; hue: number; avatar: string; isAdmin: boolean } | null;

export function Logo({ light = false }: { light?: boolean }) {
  const { t } = useI18n();
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label={t.nav.home}>
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
        <circle cx="16" cy="16" r="15" fill="#d8f24b" />
        <path d="M5 6.5c6 4 6 15 0 19M27 6.5c-6 4-6 15 0 19" fill="none" stroke="#0e3b2c" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className={`font-display text-lg font-bold tracking-tight ${light ? "text-cream" : "text-court-900"}`}>
        Sanapati<span className={light ? "text-ball" : "text-clay-600"}>.</span>
      </span>
    </Link>
  );
}

export function NavBar({ user }: { user: NavUser }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const LINKS = [
    { href: "/booking", label: t.nav.schedule },
    { href: "/jadwal", label: t.nav.calendar },
    { href: "/mabar", label: t.mabar.nav },
    { href: "/galeri", label: t.nav.gallery },
    { href: "/pemain", label: t.nav.players },
  ];
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenuOpen(false);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menuOpen]);

  const userLinks = [
    { href: "/booking-saya", label: t.nav.myBookings },
    ...(user ? [{ href: `/pemain/${user.id}`, label: t.nav.profile }] : []),
    { href: "/akun", label: t.nav.account },
    ...(user?.isAdmin ? [{ href: "/admin", label: t.nav.admin }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-cream/90 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo />

        <nav className="hidden items-center gap-0.5 lg:flex" aria-label={t.nav.main}>
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-full px-3.5 py-2 text-sm font-medium transition hover:bg-sand ${
                pathname === l.href || pathname.startsWith(`${l.href}/`) ? "bg-sand text-court-900" : "text-ink/80"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitch />
          {user ? (
            <>
              <ReminderBell />
              <div className="relative hidden lg:block" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  className="flex cursor-pointer items-center gap-2 rounded-full border border-line bg-white py-1 pl-1 pr-3 text-sm font-medium hover:border-court-700"
                >
                  <Avatar name={user.name} hue={user.hue} avatar={user.avatar} size={30} />
                  {user.name.split(" ")[0]}
                </button>
                {menuOpen && (
                  <div role="menu" className="card absolute right-0 mt-2 w-56 overflow-hidden p-1.5 shadow-xl shadow-court-950/10">
                    {userLinks.map((l) => (
                      <Link key={l.href} href={l.href} role="menuitem" className="block rounded-lg px-3 py-2 text-sm hover:bg-court-50">
                        {l.label}
                      </Link>
                    ))}
                    <form action={logout} className="mt-1 border-t border-line pt-1">
                      <button className="w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm text-clay-700 hover:bg-clay-50">
                        {t.nav.logout}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="hidden items-center gap-2 lg:flex">
              <Link href="/masuk" className="btn btn-ghost btn-sm">
                {t.nav.login}
              </Link>
              <Link href="/daftar" className="btn btn-primary btn-sm">
                {t.nav.register}
              </Link>
            </div>
          )}

          <button
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-line bg-white lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-label={t.nav.openMenu}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <path
                d={mobileOpen ? "M4 4l10 10M14 4L4 14" : "M2 5h14M2 9h14M2 13h14"}
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="border-t border-line bg-cream lg:hidden" aria-label={t.nav.mobile}>
          <div className="container-page flex flex-col gap-1 py-3">
            {[...LINKS, ...(user ? userLinks : [])].map((l) => (
              <Link key={l.href} href={l.href} className="rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-sand">
                {l.label}
              </Link>
            ))}
            {user ? (
              <form action={logout}>
                <button className="w-full cursor-pointer rounded-xl px-3 py-2.5 text-left text-sm font-medium text-clay-700 hover:bg-clay-50">
                  {t.nav.logout}
                </button>
              </form>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Link href="/masuk" className="btn btn-ghost">
                  {t.nav.login}
                </Link>
                <Link href="/daftar" className="btn btn-primary">
                  {t.nav.register}
                </Link>
              </div>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
