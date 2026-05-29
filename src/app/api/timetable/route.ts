import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifyTimetableChange } from "@/lib/notifications";
import { requireAdmin } from "@/lib/require-admin";
import { revalidatePublicSite } from "@/lib/revalidate-public";
import { bodyToSessionFields } from "@/lib/schedule-api-body";
import { findScheduleConflicts } from "@/lib/timetable-conflicts";
import { timetableSessionBodySchema } from "@/lib/timetable-api-schema";
import { validateScheduleWindow } from "@/lib/timetable-validation";
import { jsonMessage } from "@/lib/utils";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ageGroup = url.searchParams.get("ageGroup") ?? undefined;
  return NextResponse.json({ sessions: await db.listSessions(ageGroup) });
}

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
    return NextResponse.json(jsonMessage("Invalid timetable payload", { issues: parsed.error.flatten() }), { status: 400 });
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
    title: session.title,
    kind: session.kind,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    locationName: session.locationName,
    kitRequirements: session.kitRequirements
  });
  revalidatePublicSite();
  return NextResponse.json({ message: "Session created", session }, { status: 201 });
}
