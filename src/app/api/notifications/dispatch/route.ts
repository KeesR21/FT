import { NextResponse } from "next/server";
import { z } from "zod";
import {
  dispatchOverduePaymentNotifications,
  sendPaymentReminder,
  sendSubscriptionExpiryReminders,
  sendWeeklyTimetable
} from "@/lib/notifications";
import { requireAdmin } from "@/lib/require-admin";
import { jsonMessage } from "@/lib/utils";

const schema = z.object({
  type: z.enum(["payment_reminder", "weekly_timetable", "subscription_expiry_reminders", "payment_overdue"]),
  playerId: z.string().optional(),
  ageGroup: z.string().optional(),
  email: z.string().email().optional()
});

export async function POST(req: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(jsonMessage("Invalid dispatch payload", { issues: parsed.error.flatten() }), { status: 400 });
  }

  if (parsed.data.type === "payment_reminder") {
    if (!parsed.data.playerId) return NextResponse.json(jsonMessage("playerId is required"), { status: 400 });
    await sendPaymentReminder(parsed.data.playerId);
    return NextResponse.json({ message: "Payment reminder sent" });
  }

  if (parsed.data.type === "subscription_expiry_reminders") {
    const result = await sendSubscriptionExpiryReminders();
    return NextResponse.json({ message: "Subscription expiry reminders processed", ...result });
  }

  if (parsed.data.type === "payment_overdue") {
    const result = await dispatchOverduePaymentNotifications();
    return NextResponse.json({ message: "Overdue payment reminders processed", ...result });
  }

  if (!parsed.data.ageGroup || !parsed.data.email) {
    return NextResponse.json(jsonMessage("ageGroup and email are required"), { status: 400 });
  }

  await sendWeeklyTimetable(parsed.data.ageGroup, parsed.data.email);
  return NextResponse.json({ message: "Weekly timetable sent" });
}
