import type { Metadata } from "next";
import Link from "next/link";
import { adminSessionAction } from "@/app/actions/admin-control";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { StatusBadge } from "@/components/mabar/Badges";
import { getI18n } from "@/lib/i18n-server";
import { listSessions } from "@/lib/mabar";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.adminX.tabMabar };
}

export default async function AdminMabar() {
  const { t, f } = await getI18n();
  const a = t.adminX;
  const m = t.mabar;
  const cards = await listSessions(200);

  return (
    <>
      <p className="eyebrow">{a.tabMabar}</p>
      <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{a.mabarTitle}</h1>

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full min-w-[58rem] text-left text-sm">
          <thead className="border-b border-line bg-cream text-xs text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">{a.colSession}</th>
              <th className="px-3 py-3 font-medium">{a.colOwner}</th>
              <th className="px-3 py-3 font-medium">{a.colProgress}</th>
              <th className="px-3 py-3 font-medium">{t.admin.bookings.colStatus}</th>
              <th className="px-3 py-3 font-medium">{a.colAccess}</th>
              <th className="px-5 py-3 text-right font-medium">{t.admin.bookings.colAction}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {cards.map(({ session: s, ownerName, playerCount, total, done, status }) => {
              const open = !!s.open_edit && !s.finished;
              return (
                <tr key={s.id}>
                  <td className="px-5 py-3">
                    <Link href={`/mabar/${s.id}`} className="font-medium hover:underline">
                      {s.title}
                    </Link>
                    <p className="text-xs text-muted">
                      {f.dateShort(s.play_date)}
                      {s.location ? ` · ${s.location}` : ""} · {s.mode === "tournament" ? m.modeTournament : m.modeCasual} ·{" "}
                      {s.format === "doubles" ? m.fmtDoubles : m.fmtSingles}
                    </p>
                  </td>
                  <td className="px-3 py-3">{ownerName}</td>
                  <td className="px-3 py-3 text-xs text-muted">
                    {m.players(playerCount)}
                    {total > 0 && <span className="block tabular-nums">{m.progress(done, total)}</span>}
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={status} t={t} />
                  </td>
                  <td className="px-3 py-3">
                    <span className={`badge ${open ? "bg-ball text-court-950" : "bg-sand text-muted"}`}>{open ? m.badgeOpen : m.badgeLocked}</span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Link href={`/mabar/${s.id}`} className="btn btn-ghost btn-sm">
                        {a.manage}
                      </Link>
                      <form action={adminSessionAction}>
                        <input type="hidden" name="sessionId" value={s.id} />
                        <button name="op" value="lock" className="btn btn-ghost btn-sm">
                          {s.open_edit ? a.lock : a.unlock}
                        </button>
                      </form>
                      <form action={adminSessionAction}>
                        <input type="hidden" name="sessionId" value={s.id} />
                        <button name="op" value="finish" className="btn btn-ghost btn-sm">
                          {s.finished ? m.reopen : m.finish}
                        </button>
                      </form>
                      <ConfirmButton
                        action={adminSessionAction}
                        fields={{ sessionId: s.id, op: "delete" }}
                        label={a.remove}
                        message={`${s.title} — ${m.deleteConfirm}`}
                        confirmLabel={a.yesDelete}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
            {cards.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-muted">{a.noSessions}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
