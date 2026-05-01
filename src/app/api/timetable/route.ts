import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { notifyTimetableChange } from "@/lib/notifications";
import { requireAdmin } from "@/lib/require-admin";
import { revalidatePublicSite } from "@/lib/revalidate-public";
import { defaultSessionTitle, validateScheduleWindow } from "@/lib/timetable-validation";
import { jsonMessage } from "@/lib/utils";

const schema = z.object({
  title: z.string().min(2).optional(),
  ageGroup: z.string().min(2),
  kind: z.enum(["training", "match"]),
  startsAt: z.string().min(8),
  endsAt: z.string().min(8),
  locationName: z.string().min(2),
  kitRequirements: z.string().min(2)
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ageGroup = url.searchParams.get("ageGroup") ?? undefined;
  return NextResponse.json({ sessions: await db.listSessions(ageGroup) });
}

export async function POST(req: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(jsonMessage("Invalid timetable payload", { issues: parsed.error.flatten() }), { status: 400 });
  }

  const v = validateScheduleWindow(parsed.data.startsAt, parsed.data.endsAt);
  if (!v.ok) {
    return NextResponse.json(jsonMessage(v.error), { status: 400 });
  }

  const { title: titleIn, ...rest } = parsed.data;
  const title = titleIn?.trim() || defaultSessionTitle(rest.ageGroup, rest.kind);
  const session = await db.createSession({
    ...rest,
    title,
    isUpdated: false,
    updatedAt: null
  });
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
