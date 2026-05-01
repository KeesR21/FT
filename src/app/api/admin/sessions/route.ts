import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { notifyTimetableChange } from "@/lib/notifications";
import { requireAdmin } from "@/lib/require-admin";
import { revalidateAdminViews } from "@/lib/revalidate-admin";
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

export async function POST(req: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(jsonMessage("Expected JSON body"), { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(jsonMessage("Invalid session", { issues: parsed.error.flatten() }), { status: 400 });
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
  await notifyTimetableChange(parsed.data.ageGroup, "created", {
    kind: session.kind,
    startsAt: session.startsAt,
    locationName: session.locationName
  });
  revalidatePublicSite();
  revalidateAdminViews();

  return NextResponse.json({ session }, { status: 201 });
}
