/**
 * Balok abu-abu penanda "sedang dimuat". Dipakai file loading.tsx di tiap segmen rute.
 * motion-reduce: animasi dimatikan untuk pengguna yang memilih kurangi gerak di sistemnya.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-xl bg-sand motion-reduce:animate-none ${className}`} />;
}

/** Pembungkus yang mengumumkan status muat ke pembaca layar sekali saja, bukan tiap balok. */
export function LoadingShell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
