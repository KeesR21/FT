import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { revalidateAdminViews } from "@/lib/revalidate-admin";
import { normalizeSessionInput } from "@/lib/weekly-schedule/labels";
import { sessionBodySchema } from "@/lib/weekly-schedule/api-schema";
import { weeklySchedule } from "@/lib/weekly-schedule/server";
import { syncTeamCoachesFromCms } from "@/lib/weekly-schedule/sync-team-coaches";
import { syncPitchLocationsFromCms } from "@/lib/weekly-schedule/sync-pitch-locations";
import { jsonMessage } from "@/lib/utils";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  await syncTeamCoachesFromCms();
  await syncPitchLocationsFromCms();
  const { id, sessionId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(jsonMessage("Expected JSON body"), { status: 400 });
  }
  const parsed = sessionBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(jsonMessage("Invalid session"), { status: 400 });
  }

  try {
    const session = weeklySchedule.updateSession(id, sessionId, normalizeSessionInput(parsed.data));
    revalidateAdminViews();
    return NextResponse.json({ session });
  } catch (e) {
    return NextResponse.json(
      jsonMessage(e instanceof Error ? e.message : "Update failed"),
      { status: 400 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  await syncTeamCoachesFromCms();
  await syncPitchLocationsFromCms();
  const { id, sessionId } = await params;

  try {
    const ok = weeklySchedule.deleteSession(id, sessionId);
    if (!ok) return NextResponse.json(jsonMessage("Session not found"), { status: 404 });
    revalidateAdminViews();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      jsonMessage(e instanceof Error ? e.message : "Delete failed"),
      { status: 400 }
    );
  }
}
