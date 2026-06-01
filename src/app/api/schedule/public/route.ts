import { NextResponse } from "next/server";
import { weeklySchedule } from "@/lib/weekly-schedule/server";
import { syncTeamCoachesFromCms } from "@/lib/weekly-schedule/sync-team-coaches";
import { syncPitchLocationsFromCms } from "@/lib/weekly-schedule/sync-pitch-locations";
import { jsonMessage } from "@/lib/utils";

export async function GET(req: Request) {
  // Sync coaches + pitches from the CMS so names resolve correctly.
  await syncTeamCoachesFromCms();
  await syncPitchLocationsFromCms();
  const url = new URL(req.url);
  const weekStart = url.searchParams.get("weekStart") ?? undefined;
  const schedule = weeklySchedule.getPublicSchedule(weekStart ?? undefined);
  if (!schedule) {
    return NextResponse.json(jsonMessage("No published schedule for this week."), { status: 404 });
  }
  return NextResponse.json({ schedule });
}
