import { NextResponse } from "next/server";
import { weeklySchedule } from "@/lib/weekly-schedule/server";

export async function GET() {
  return NextResponse.json({ weekStarts: weeklySchedule.listPublishedWeekStarts() });
}
