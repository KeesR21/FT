import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifyTimetableChange } from "@/lib/notifications";
import { requireAdmin } from "@/lib/require-admin";
import { revalidateAdminViews } from "@/lib/revalidate-admin";
import { revalidatePublicSite } from "@/lib/revalidate-public";
import { bodyToSessionFields } from "@/lib/schedule-api-body";
import { findScheduleConflicts } from "@/lib/timetable-conflicts";
import { timetableSessionBodySchema } from "@/lib/timetable-api-schema";
import { validateScheduleWindow } from "@/lib/timetable-validation";
import { jsonMessage } from "@/lib/utils";

export async function POST(req: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(jsonMessage("Expected JSON body"), { status: 400 });
  }
  const parsed = timetableSessionBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(jsonMessage("Invalid session", { issues: parsed.error.flatten() }), { status: 400 });
  }

  const v = validateScheduleWindow(parsed.data.startsAt, parsed.data.endsAt);
  if (!v.ok) {
    return NextResponse.json(jsonMessage(v.error), { status: 400 });
  }

  const fields = bodyToSessionFields(parsed.data);
  const existing = await db.listSessions();
  const conflicts = findScheduleConflicts(existing, { id: "", ...fields });
  if (conflicts.length) {
    return NextResponse.json(
      jsonMessage("Scheduling conflict detected.", { conflicts }),
      { status: 409 }
    );
  }

  const session = await db.createSession(fields);
  await notifyTimetableChange(session.ageGroup, "created", {
    kind: session.kind,
    startsAt: session.startsAt,
    locationName: session.locationName
  });
  revalidatePublicSite();
  revalidateAdminViews();

  return NextResponse.json({ session }, { status: 201 });
}
