import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifyTimetableChange } from "@/lib/notifications";
import { requireAdmin } from "@/lib/require-admin";
import { revalidateAdminViews } from "@/lib/revalidate-admin";
import { revalidatePublicSite } from "@/lib/revalidate-public";
import { patchToSessionFields } from "@/lib/schedule-api-body";
import { findScheduleConflicts } from "@/lib/timetable-conflicts";
import { timetableSessionPatchSchema } from "@/lib/timetable-api-schema";
import { validateScheduleWindow, validateSessionTimes } from "@/lib/timetable-validation";
import { jsonMessage } from "@/lib/utils";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(jsonMessage("Expected JSON body"), { status: 400 });
  }
  const parsed = timetableSessionPatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json(jsonMessage("Invalid session patch"), { status: 400 });

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json(jsonMessage("No changes provided"), { status: 400 });
  }

  const existing = await db.getSession(id);
  if (!existing) return NextResponse.json(jsonMessage("Session not found"), { status: 404 });

  const nextStart = parsed.data.startsAt ?? existing.startsAt;
  const nextEnd = parsed.data.endsAt ?? existing.endsAt;
  const startMoved = nextStart !== existing.startsAt;
  const v = startMoved ? validateScheduleWindow(nextStart, nextEnd) : validateSessionTimes(nextStart, nextEnd);
  if (!v.ok) {
    return NextResponse.json(jsonMessage(v.error), { status: 400 });
  }

  const fields = patchToSessionFields(parsed.data, existing);
  const all = await db.listSessions();
  const conflicts = findScheduleConflicts(all, { id, ...fields }, { excludeId: id });
  if (conflicts.length) {
    return NextResponse.json(
      jsonMessage("Scheduling conflict detected.", { conflicts }),
      { status: 409 }
    );
  }

  const s = await db.updateSession(id, {
    ...fields,
    isUpdated: true,
    updatedAt: new Date().toISOString()
  });
  if (!s) return NextResponse.json(jsonMessage("Session not found"), { status: 404 });

  await notifyTimetableChange(s.ageGroup, "updated", {
    title: s.title,
    kind: s.kind,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    locationName: s.locationName,
    kitRequirements: s.kitRequirements
  });
  revalidatePublicSite();
  revalidateAdminViews();

  return NextResponse.json({ session: s });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const { id } = await params;

  const existing = await db.getSession(id);
  if (!existing) return NextResponse.json(jsonMessage("Session not found"), { status: 404 });

  const ok = await db.deleteSession(id);
  if (!ok) return NextResponse.json(jsonMessage("Session not found"), { status: 404 });

  await notifyTimetableChange(existing.ageGroup, "removed", {
    title: existing.title,
    kind: existing.kind,
    startsAt: existing.startsAt,
    endsAt: existing.endsAt,
    locationName: existing.locationName,
    kitRequirements: existing.kitRequirements
  });
  revalidatePublicSite();
  revalidateAdminViews();

  return NextResponse.json({ ok: true });
}
