import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { revalidateAdminViews } from "@/lib/revalidate-admin";
import { revalidatePublicSite } from "@/lib/revalidate-public";
import { weeklySchedule, weeklyScheduleReady } from "@/lib/weekly-schedule/server";
import { jsonMessage } from "@/lib/utils";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ weekId: string }> }
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  await weeklyScheduleReady();

  const { weekId } = await params;

  try {
    const ok = weeklySchedule.deleteWeek(weekId);
    if (!ok) return NextResponse.json(jsonMessage("Week not found"), { status: 404 });
    revalidatePublicSite();
    revalidateAdminViews();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      jsonMessage(e instanceof Error ? e.message : "Could not delete week"),
      { status: 400 }
    );
  }
}
