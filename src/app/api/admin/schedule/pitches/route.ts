import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { pitchBodySchema } from "@/lib/weekly-schedule/api-schema";
import { weeklySchedule } from "@/lib/weekly-schedule/server";
import { jsonMessage } from "@/lib/utils";

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  return NextResponse.json({ pitches: weeklySchedule.listPitches() });
}

export async function POST(req: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const body = await req.json();
  const parsed = pitchBodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json(jsonMessage("Invalid pitch"), { status: 400 });
  const pitch = weeklySchedule.createPitch(parsed.data);
  return NextResponse.json({ pitch }, { status: 201 });
}
