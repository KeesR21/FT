import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { revalidateAdminViews } from "@/lib/revalidate-admin";
import { normalizeSessionInput } from "@/lib/weekly-schedule/labels";
import { sessionBodySchema } from "@/lib/weekly-schedule/api-schema";
import { weeklySchedule } from "@/lib/weekly-schedule/server";
import { syncTeamCoachesFromCms } from "@/lib/weekly-schedule/sync-team-coaches";
import { jsonMessage } from "@/lib/utils";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  await syncTeamCoachesFromCms();
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(jsonMessage("Expected JSON body"), { status: 400 });
  }
  const parsed = sessionBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(jsonMessage("Invalid session", { issues: parsed.error.flatten() }), {
      status: 400
    });
  }

  try {
    const session = weeklySchedule.addSession(id, normalizeSessionInput(parsed.data));
    revalidateAdminViews();
    return NextResponse.json({ session }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      jsonMessage(e instanceof Error ? e.message : "Could not add session"),
      { status: 400 }
    );
  }
}
