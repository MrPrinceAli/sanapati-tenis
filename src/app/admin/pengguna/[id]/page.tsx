import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UserForm } from "@/components/admin/AdminForms";
import { Avatar, LevelBadge } from "@/components/Avatar";
import { ResetLinkDialog } from "@/components/ResetForms";
import { getCurrentUser } from "@/lib/auth";
import { getUserBookings, isPast } from "@/lib/bookings";
import { db, type User } from "@/lib/db";
import { opt, translateReason } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n-server";

type Params = { params: Promise<{ id: string }> };

const load = (id: string) =>
  /^[0-9]+$/.test(id) ? (db.prepare("SELECT * FROM users WHERE id = ?").get(Number(id)) as User | undefined) : undefined;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  return { title: load((await params).id)?.name ?? "—" };
}

export default async function AdminUserPage({ params }: Params) {
  const user = load((await params).id);
  if (!user) notFound();
  const me = await getCurrentUser();
  const { t, f } = await getI18n();
  const a = t.adminX;
  const bookings = getUserBookings(user.id);

  return (
    <>
      <Link href="/admin/pengguna" className="text-sm font-medium text-court-700 hover:underline">
        {a.backUsers}
      </Link>

      <header className="mt-4 flex flex-wrap items-center gap-4">
        <Avatar name={user.name} hue={user.avatar_hue} avatar={user.avatar} size={64} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`badge ${user.role === "admin" ? "bg-court-900 text-ball" : "bg-sand text-ink"}`}>
              {user.role === "admin" ? t.admin.users.admin : t.admin.users.member}
            </span>
            <LevelBadge level={user.level} label={opt(t, user.level)} />
            {user.suspended === 1 && <span className="badge bg-clay-100 text-clay-700">{a.badgeSuspended}</span>}
          </div>
          <h1 className="mt-1 truncate text-3xl font-bold sm:text-4xl">{user.name}</h1>
          <p className="text-sm text-muted">
            {user.email} · {t.players.joined(f.monthYear(user.created_at))}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/pemain/${user.id}`} className="btn btn-ghost btn-sm">
            {t.account.viewPublic}
          </Link>
          <ResetLinkDialog userId={user.id} name={user.name} />
        </div>
      </header>

      <section className="card mt-6 p-6">
        <UserForm
          isSelf={me?.id === user.id}
          user={{
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            level: user.level,
            hand: user.hand,
            backhand: user.backhand,
            city: user.city,
            bio: user.bio,
            role: user.role,
            suspended: user.suspended,
            is_public: user.is_public,
          }}
        />
      </section>

      <section className="card mt-4 overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-6 pb-4">
          <h2 className="text-lg font-semibold">{a.sectionBookings(bookings.length)}</h2>
          <Link href={`/admin/booking?q=${encodeURIComponent(user.email)}`} className="text-sm font-semibold text-court-700 hover:underline">
            {t.admin.overview.manage}
          </Link>
        </div>
        {bookings.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted">{a.noBookings}</p>
        ) : (
          <ul className="divide-y divide-line border-t border-line text-sm">
            {bookings.slice(0, 15).map((b) => (
              <li key={b.id} className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-6 py-3 ${b.status === "cancelled" ? "text-muted" : ""}`}>
                <span className="font-medium">
                  {f.dateShort(b.date)} · {f.range(b.start_hour, b.end_hour)}
                </span>
                <span>{b.court_name}</span>
                <span className="font-mono text-xs text-muted">{b.code}</span>
                {b.status === "cancelled" ? (
                  <span className="badge bg-clay-100 text-clay-700" title={translateReason(t, b.cancel_reason)}>
                    {t.admin.bookings.cancelled}
                  </span>
                ) : (
                  <span className={`badge ${isPast(b) ? "bg-sand text-muted" : "bg-court-100 text-court-800"}`}>
                    {isPast(b) ? t.admin.bookings.done : t.admin.bookings.active}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
