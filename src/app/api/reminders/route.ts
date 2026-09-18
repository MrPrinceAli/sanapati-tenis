import { getCurrentUser } from "@/lib/auth";
import { getUpcomingForUser } from "@/lib/bookings";
import { slotMs } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ reminders: [] }, { status: 401 });

  const reminders = getUpcomingForUser(user.id, 48).map((b) => ({
    code: b.code,
    court: b.court_name,
    date: b.date,
    start: b.start_hour,
    end: b.end_hour,
    startsAt: slotMs(b.date, b.start_hour),
    endsAt: slotMs(b.date, b.end_hour),
  }));
  return Response.json({ reminderMinutes: user.reminder_minutes, reminders });
}
