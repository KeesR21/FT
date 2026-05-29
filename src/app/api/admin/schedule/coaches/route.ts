import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { coachBodySchema } from "@/lib/weekly-schedule/api-schema";
import { weeklySchedule } from "@/lib/weekly-schedule/server";
import { syncTeamCoachesFromCms } from "@/lib/weekly-schedule/sync-team-coaches";
import { jsonMessage } from "@/lib/utils";

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  await syncTeamCoachesFromCms();
  return NextResponse.json({
    coaches: weeklySchedule.listCoaches().filter((c) => c.active)
  });
}

export async function POST(req: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const body = await req.json();
  const parsed = coachBodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json(jsonMessage("Invalid coach"), { status: 400 });
  const coach = weeklySchedule.createCoach(parsed.data);
  return NextResponse.json({ coach }, { status: 201 });
}
