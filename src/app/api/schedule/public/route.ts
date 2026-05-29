import { NextResponse } from "next/server";
import { weeklySchedule } from "@/lib/weekly-schedule/server";
import { syncTeamCoachesFromCms } from "@/lib/weekly-schedule/sync-team-coaches";
import { jsonMessage } from "@/lib/utils";

export async function GET(req: Request) {
  // Sync coaches from the /our-team CMS page so coach names resolve correctly.
  await syncTeamCoachesFromCms();
  const url = new URL(req.url);
  const weekStart = url.searchParams.get("weekStart") ?? undefined;
  const schedule = weeklySchedule.getPublicSchedule(weekStart ?? undefined);
  if (!schedule) {
    return NextResponse.json(jsonMessage("No published schedule for this week."), { status: 404 });
  }
  return NextResponse.json({ schedule });
}
