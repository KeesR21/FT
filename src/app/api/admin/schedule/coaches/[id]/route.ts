import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { weeklySchedule } from "@/lib/weekly-schedule/server";
import { syncTeamCoachesFromCms } from "@/lib/weekly-schedule/sync-team-coaches";
import { jsonMessage } from "@/lib/utils";

const patchSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  active: z.boolean().optional()
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  await syncTeamCoachesFromCms();
  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json(jsonMessage("Invalid patch"), { status: 400 });
  const coach = weeklySchedule.updateCoach(id, parsed.data);
  if (!coach) return NextResponse.json(jsonMessage("Coach not found"), { status: 404 });
  return NextResponse.json({ coach });
}
