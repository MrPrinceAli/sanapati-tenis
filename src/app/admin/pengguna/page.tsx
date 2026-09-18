import type { Metadata } from "next";
import Link from "next/link";
import { UserForm } from "@/components/admin/AdminForms";
import { DeleteUserDialog } from "@/components/admin/DeleteUserDialog";
import { Avatar, LevelBadge } from "@/components/Avatar";
import { db } from "@/lib/db";
import { opt } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n-server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.admin.tabs.users };
}

type Row = {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  level: string;
  avatar_hue: number;
  avatar: string;
  suspended: number;
  created_at: string;
  bookings: number;
  all_bookings: number;
  hours: number;
};

export default async function AdminUsers() {
  const { t, f } = await getI18n();
  const u = t.admin.users;
  const users = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.level, u.avatar_hue, u.avatar, u.suspended, u.created_at,
              COUNT(CASE WHEN b.status = 'confirmed' AND b.kind = 'booking' THEN 1 END) AS bookings,
              COUNT(b.id) AS all_bookings,
              COALESCE(SUM(CASE WHEN b.status = 'confirmed' AND b.kind = 'booking' THEN b.end_hour - b.start_hour END), 0) AS hours
       FROM users u LEFT JOIN bookings b ON b.user_id = u.id
       GROUP BY u.id ORDER BY u.role = 'admin' DESC, hours DESC`
    )
    .all() as Row[];

  return (
    <>
      <p className="eyebrow">{t.admin.tabs.users}</p>
      <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{u.title(users.length)}</h1>

      <details className="card mt-6 border-dashed p-5">
        <summary className="cursor-pointer list-none font-semibold text-court-700">{t.adminX.addUser}</summary>
        <div className="mt-5 border-t border-line pt-5">
          <UserForm />
        </div>
      </details>

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="border-b border-line bg-cream text-xs text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">{u.colUser}</th>
              <th className="px-3 py-3 font-medium">{u.colContact}</th>
              <th className="px-3 py-3 text-right font-medium">{u.colBookings}</th>
              <th className="px-3 py-3 text-right font-medium">{u.colHours}</th>
              <th className="px-3 py-3 font-medium">{u.colJoined}</th>
              <th className="px-5 py-3 text-right font-medium">{u.colRole}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((row) => (
              <tr key={row.id}>
                <td className="px-5 py-3">
                  <Link href={`/admin/pengguna/${row.id}`} className="flex items-center gap-3 hover:underline">
                    <Avatar name={row.name} hue={row.avatar_hue} avatar={row.avatar} size={36} />
                    <span>
                      <span className="block font-medium">{row.name}</span>
                      <LevelBadge level={row.level} label={opt(t, row.level)} />
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-3 text-xs text-muted">
                  <p>{row.email}</p>
                  <p>{row.phone}</p>
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{row.bookings}</td>
                <td className="px-3 py-3 text-right tabular-nums">{row.hours}</td>
                <td className="px-3 py-3 text-xs text-muted">{f.timestamp(row.created_at)}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <span className={`badge ${row.role === "admin" ? "bg-court-900 text-ball" : "bg-sand text-ink"}`}>
                      {row.role === "admin" ? u.admin : u.member}
                    </span>
                    {row.suspended === 1 && <span className="badge bg-clay-100 text-clay-700">{t.adminX.badgeSuspended}</span>}
                    <Link href={`/admin/pengguna/${row.id}`} className="btn btn-ghost btn-sm">
                      {t.adminX.manage}
                    </Link>
                    {row.role !== "admin" && <DeleteUserDialog userId={row.id} name={row.name} bookings={row.all_bookings} />}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
