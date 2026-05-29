import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { revalidateAdminViews } from "@/lib/revalidate-admin";
import { weeklySchedule } from "@/lib/weekly-schedule/server";
import { jsonMessage } from "@/lib/utils";

export async function POST(_req: Request, { params }: { params: Promise<{ weekId: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const { weekId } = await params;

  try {
    const version = weeklySchedule.createUpdateVersion(weekId);
    revalidateAdminViews();
    return NextResponse.json({ version }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      jsonMessage(e instanceof Error ? e.message : "Could not create update"),
      { status: 400 }
    );
  }
}
