import type { Metadata } from "next";
import { removeBlock } from "@/app/actions/admin";
import { deleteCourt } from "@/app/actions/admin-control";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { BlockForm, CourtForm } from "@/components/admin/CourtForms";
import { getCourts } from "@/lib/bookings";
import { db } from "@/lib/db";
import { opt } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n-server";
import { ADMIN_MAX_DAYS_AHEAD } from "@/lib/rules";
import { addDays, todayWIB } from "@/lib/time";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.admin.tabs.courts };
}

type BlockRow = { id: number; date: string; start_hour: number; end_hour: number; note: string; court_name: string };

export default async function AdminCourts() {
  const { t, f } = await getI18n();
  const c = t.admin.courts;
  const today = todayWIB();
  const courts = await getCourts(false);
  const blocks = await db.all(`SELECT b.id, b.date, b.start_hour, b.end_hour, b.note, c.name AS court_name FROM bookings b
       JOIN courts c ON c.id = b.court_id
       WHERE b.kind = 'block' AND b.status = 'confirmed' AND b.date >= ? ORDER BY b.date, b.start_hour`, today) as BlockRow[];
  const usage = new Map(
    (await db.all("SELECT court_id, COUNT(*) AS n FROM bookings GROUP BY court_id") as { court_id: number; n: number }[]).map((r) => [r.court_id, r.n])
  );

  return (
    <>
      <p className="eyebrow">{t.admin.tabs.courts}</p>
      <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{c.title}</h1>

      <div className="mt-6 grid items-start gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="space-y-3">
          {courts.map((court) => (
            <details key={court.id} className="card group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-semibold">{court.name}</p>
                  <p className="text-xs text-muted">
                    {opt(t, court.surface)} · {court.indoor ? t.common.indoor : t.common.outdoor} · {f.range(court.open_hour, court.close_hour)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge ${court.active ? "bg-court-100 text-court-800" : "bg-sand text-muted"}`}>
                    {court.active ? c.active : c.inactive}
                  </span>
                  <span className="text-sm font-semibold text-court-700 group-open:hidden">{c.edit}</span>
                  <span className="hidden text-sm font-semibold text-muted group-open:inline">{t.common.close}</span>
                </div>
              </summary>
              <div className="mt-5 border-t border-line pt-5">
                <CourtForm court={court} />
                <div className="mt-5 flex justify-end border-t border-line pt-4">
                  <ConfirmButton
                    action={deleteCourt}
                    fields={{ courtId: court.id }}
                    label={t.adminX.deleteCourt}
                    message={t.adminX.deleteCourtConfirm(court.name, usage.get(court.id) ?? 0)}
                    confirmLabel={t.adminX.yesDelete}
                  />
                </div>
              </div>
            </details>
          ))}
          <details className="card border-dashed p-5">
            <summary className="cursor-pointer list-none font-semibold text-court-700">{c.add}</summary>
            <div className="mt-5 border-t border-line pt-5">
              <CourtForm />
            </div>
          </details>
        </section>

        <section className="card p-5">
          <h2 className="text-lg font-semibold">{c.blockTitle}</h2>
          <p className="mt-1 text-xs text-muted">{c.blockLead}</p>
          <div className="mt-4">
            <BlockForm
              courts={courts.filter((court) => court.active).map((court) => ({ id: court.id, name: court.name }))}
              minDate={today}
              maxDate={addDays(today, ADMIN_MAX_DAYS_AHEAD)}
            />
          </div>

          <h3 className="mt-6 border-t border-line pt-5 text-sm font-semibold">{c.activeBlocks(blocks.length)}</h3>
          {blocks.length === 0 ? (
            <p className="mt-2 text-sm text-muted">{c.noBlocks}</p>
          ) : (
            <ul className="mt-2 divide-y divide-line text-sm">
              {blocks.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="font-medium">{b.court_name}</p>
                    <p className="text-xs text-muted">
                      {f.dateShort(b.date)} · {f.range(b.start_hour, b.end_hour)} · {opt(t, b.note)}
                    </p>
                  </div>
                  <form action={removeBlock}>
                    <input type="hidden" name="bookingId" value={b.id} />
                    <button className="btn btn-ghost btn-sm">{c.unblock}</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
