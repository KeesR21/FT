import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { revalidateAdminViews } from "@/lib/revalidate-admin";
import { revalidatePublicSite } from "@/lib/revalidate-public";
import { createWeekSchema } from "@/lib/weekly-schedule/api-schema";
import { weeklySchedule } from "@/lib/weekly-schedule/server";
import { jsonMessage } from "@/lib/utils";

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  return NextResponse.json({ weeks: weeklySchedule.listWeeksAdmin() });
}

export async function POST(req: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(jsonMessage("Expected JSON body"), { status: 400 });
  }
  const parsed = createWeekSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(jsonMessage("Invalid week"), { status: 400 });
  }

  try {
    const { week, version } = weeklySchedule.createWeek(parsed.data.weekStart);
    revalidatePublicSite();
    revalidateAdminViews();
    return NextResponse.json({ week, version }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      jsonMessage(e instanceof Error ? e.message : "Could not create week"),
      { status: 400 }
    );
  }
}
