import { getCurrentUser } from "@/lib/auth";
import { getBookingByCode } from "@/lib/bookings";
import { getI18n } from "@/lib/i18n-server";
import { slotMs } from "@/lib/time";

const stamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/([\\;,])/g, "\\$1").replace(/\n/g, "\\n");

// File kalender dengan alarm, supaya pengingat tetap jalan walau website tidak dibuka.
export async function GET(_: Request, { params }: { params: Promise<{ code: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { code } = await params;
  const b = getBookingByCode(code);
  if (!b || b.user_id !== user.id || b.status !== "confirmed") return new Response("Not found", { status: 404 });
  const { t } = await getI18n();

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sanapati Tenis//Booking//ID",
    "BEGIN:VEVENT",
    `UID:${b.code}@sanapati-tenis`,
    `DTSTAMP:${stamp(Date.now())}`,
    `DTSTART:${stamp(slotMs(b.date, b.start_hour))}`,
    `DTEND:${stamp(slotMs(b.date, b.end_hour))}`,
    `SUMMARY:${esc(t.reminder.icsSummary(b.court_name))}`,
    `DESCRIPTION:${esc(t.reminder.icsDescription(b.code))}`,
    `LOCATION:${esc(b.court_name)}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(t.reminder.icsAlarm(b.court_name))}`,
    `TRIGGER:-PT${user.reminder_minutes}M`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${b.code}.ics"`,
    },
  });
}
