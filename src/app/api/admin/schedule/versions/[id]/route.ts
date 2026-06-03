import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { revalidateAdminViews } from "@/lib/revalidate-admin";
import { revalidatePublicSite } from "@/lib/revalidate-public";
import { weeklySchedule } from "@/lib/weekly-schedule/server";
import { syncTeamCoachesFromCms } from "@/lib/weekly-schedule/sync-team-coaches";
import { syncPitchLocationsFromCms } from "@/lib/weekly-schedule/sync-pitch-locations";
import { jsonMessage } from "@/lib/utils";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  await syncTeamCoachesFromCms();
  await syncPitchLocationsFromCms();
  const { id } = await params;
  const detail = weeklySchedule.getVersionDetail(id);
  if (!detail) return NextResponse.json(jsonMessage("Version not found"), { status: 404 });
  return NextResponse.json({ detail });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  await syncTeamCoachesFromCms();
  await syncPitchLocationsFromCms();
  const { id } = await params;
  try {
    const ok = weeklySchedule.discardDraft(id);
    if (!ok) return NextResponse.json(jsonMessage("Draft not found"), { status: 404 });
    revalidatePublicSite();
    revalidateAdminViews();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      jsonMessage(e instanceof Error ? e.message : "Could not discard draft"),
      { status: 400 }
    );
  }
}
