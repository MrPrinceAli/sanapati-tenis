import type { Metadata } from "next";
import Link from "next/link";
import { adminDeleteBooking } from "@/app/actions/admin-control";
import { AdminCancelDialog } from "@/components/admin/AdminCancelDialog";
import { AdminCreateBookingForm, BookingEditDialog, RestoreBookingButton } from "@/components/admin/BookingControls";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { getCourts, isPast, type BookingRow } from "@/lib/bookings";
import { db } from "@/lib/db";
import { translateReason } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n-server";
import { isValidDate, todayWIB } from "@/lib/time";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.admin.tabs.bookings };
}

type Search = { tanggal?: string; status?: string; q?: string };

export default async function AdminBookings({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const { t, f } = await getI18n();
  const a = t.admin.bookings;
  const date = isValidDate(sp.tanggal) ? sp.tanggal : "";
  const status = sp.status === "confirmed" || sp.status === "cancelled" ? sp.status : "";
  const q = (sp.q ?? "").trim().slice(0, 60);

  const rows = await db.all(`SELECT b.*, c.name AS court_name, c.surface, c.indoor, u.name AS user_name, u.email AS user_email, u.phone AS user_phone
       FROM bookings b JOIN courts c ON c.id = b.court_id JOIN users u ON u.id = b.user_id
       WHERE b.kind = 'booking'
         AND (@date = '' OR b.date = @date)
         AND (@status = '' OR b.status = @status)
         AND (@q = '' OR u.name LIKE @like OR b.code LIKE @like OR u.email LIKE @like)
       ORDER BY b.date DESC, b.start_hour DESC LIMIT 200`, { date, status, q, like: `%${q}%` }) as BookingRow[];

  const x = t.adminX;
  const courts = (await getCourts(false)).map((c) => ({ id: c.id, name: c.name }));
  const users = await db.all("SELECT id, name, email FROM users WHERE suspended = 0 ORDER BY name") as { id: number; name: string; email: string }[];

  return (
    <>
      <p className="eyebrow">{t.admin.tabs.bookings}</p>
      <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{a.title}</h1>

      <details className="card mt-6 border-dashed p-5">
        <summary className="cursor-pointer list-none font-semibold text-court-700">{x.newBooking}</summary>
        <div className="mt-5 border-t border-line pt-5">
          <AdminCreateBookingForm users={users} courts={courts} today={todayWIB()} />
        </div>
      </details>

      <form className="card mt-6 grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
        <div>
          <label htmlFor="q" className="label">{a.search}</label>
          <input id="q" name="q" defaultValue={q} className="input" placeholder={a.searchPh} />
        </div>
        <div>
          <label htmlFor="tanggal" className="label">{a.date}</label>
          <input id="tanggal" name="tanggal" type="date" defaultValue={date} className="input" />
        </div>
        <div>
          <label htmlFor="status" className="label">{a.status}</label>
          <select id="status" name="status" defaultValue={status} className="input">
            <option value="">{a.all}</option>
            <option value="confirmed">{a.confirmed}</option>
            <option value="cancelled">{a.cancelled}</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary">{a.apply}</button>
          <Link href="/admin/booking" className="btn btn-ghost">{a.reset}</Link>
        </div>
      </form>

      <p className="mt-4 text-sm text-muted">{a.count(rows.length, rows.length === 200)}</p>

      <div className="card mt-2 overflow-x-auto">
        <table className="w-full min-w-[60rem] text-left text-sm">
          <thead className="border-b border-line bg-cream text-xs text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">{a.colSchedule}</th>
              <th className="px-3 py-3 font-medium">{a.colCourt}</th>
              <th className="px-3 py-3 font-medium">{a.colPlayer}</th>
              <th className="px-3 py-3 font-medium">{a.colStatus}</th>
              <th className="px-5 py-3 text-right font-medium">{a.colAction}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((b) => {
              const past = isPast(b);
              return (
                <tr key={b.id} className={b.status === "cancelled" ? "text-muted" : ""}>
                  <td className="px-5 py-3">
                    <p className="font-medium">{f.dateShort(b.date)}</p>
                    <p className="text-xs tabular-nums text-muted">{f.range(b.start_hour, b.end_hour)}</p>
                  </td>
                  <td className="px-3 py-3">{b.court_name}</td>
                  <td className="px-3 py-3">
                    <p className="font-medium">{b.user_name}</p>
                    <p className="text-xs text-muted">
                      {b.user_phone} · <span className="font-mono">{b.code}</span>
                    </p>
                    {b.note && <p className="text-xs text-muted">“{b.note}”</p>}
                  </td>
                  <td className="px-3 py-3">
                    {b.status === "cancelled" ? (
                      <>
                        <span className="badge bg-clay-100 text-clay-700">{a.cancelled}</span>
                        <p className="mt-1 max-w-56 text-xs">{translateReason(t, b.cancel_reason)}</p>
                      </>
                    ) : (
                      <span className={`badge ${past ? "bg-sand text-muted" : "bg-court-100 text-court-800"}`}>{past ? a.done : a.active}</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap items-start justify-end gap-1.5">
                      <BookingEditDialog
                        bookingId={b.id}
                        code={b.code}
                        courts={courts}
                        slot={{ courtId: b.court_id, date: b.date, start: b.start_hour, end: b.end_hour, note: b.note }}
                      />
                      {b.status === "cancelled" && <RestoreBookingButton bookingId={b.id} />}
                      {b.status === "confirmed" && !past && (
                        <AdminCancelDialog
                          bookingId={b.id}
                          summary={`${b.user_name} · ${b.court_name} · ${f.dateShort(b.date)} ${f.range(b.start_hour, b.end_hour)}`}
                        />
                      )}
                      <ConfirmButton
                        action={adminDeleteBooking}
                        fields={{ bookingId: b.id }}
                        label={x.remove}
                        message={`${b.code} · ${b.user_name} · ${f.dateShort(b.date)} ${f.range(b.start_hour, b.end_hour)} — ${x.deleteBookingConfirm}`}
                        confirmLabel={x.yesDelete}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-muted">{a.none}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
