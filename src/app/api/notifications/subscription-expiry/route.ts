import { NextResponse } from "next/server";
import { sendSubscriptionExpiryReminders } from "@/lib/notifications";
import { requireAdmin } from "@/lib/require-admin";
import { jsonMessage } from "@/lib/utils";

function isValidCronRequest(req: Request): boolean {
  const expected = process.env.NOTIFICATIONS_CRON_SECRET;
  if (!expected) return false;
  const provided = req.headers.get("x-cron-secret");
  return Boolean(provided && provided === expected);
}

export async function POST(req: Request) {
  if (!isValidCronRequest(req)) {
    const unauthorized = await requireAdmin();
    if (unauthorized) return unauthorized;
  }

  const result = await sendSubscriptionExpiryReminders();
  return NextResponse.json({
    message: "Subscription expiry reminders processed",
    ...result
  });
}

export async function GET(req: Request) {
  if (!isValidCronRequest(req)) {
    const unauthorized = await requireAdmin();
    if (unauthorized) return unauthorized;
  }
  return NextResponse.json(
    jsonMessage("Use POST to dispatch expiry reminders. Configure NOTIFICATIONS_CRON_SECRET for cron automation.")
  );
}
