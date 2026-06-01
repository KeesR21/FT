import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { pitchBodySchema } from "@/lib/weekly-schedule/api-schema";
import { weeklySchedule, weeklyScheduleReady } from "@/lib/weekly-schedule/server";
import { syncPitchLocationsFromCms } from "@/lib/weekly-schedule/sync-pitch-locations";
import { jsonMessage } from "@/lib/utils";

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  await weeklyScheduleReady();
  await syncPitchLocationsFromCms();
  return NextResponse.json({ pitches: weeklySchedule.listPitches() });
}

export async function POST(req: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  await weeklyScheduleReady();
  const body = await req.json();
  const parsed = pitchBodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json(jsonMessage("Invalid pitch"), { status: 400 });
  const pitch = weeklySchedule.createPitch(parsed.data);
  return NextResponse.json({ pitch }, { status: 201 });
}
