import { NextResponse } from "next/server";
import { weeklySchedule, weeklyScheduleReady } from "@/lib/weekly-schedule/server";

export async function GET() {
  await weeklyScheduleReady();
  return NextResponse.json({ weekStarts: weeklySchedule.listPublishedWeekStarts() });
}
