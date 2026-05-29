import { NextResponse } from "next/server";
import { z } from "zod";
import { getKitOrderingPeriod, setKitOrderingEnabled, updateKitOrderingAnnouncement } from "@/lib/kit-period-store";
import { requireAdmin } from "@/lib/require-admin";
import { revalidateAdminViews } from "@/lib/revalidate-admin";
import { revalidatePublicSite } from "@/lib/revalidate-public";
import { jsonMessage } from "@/lib/utils";

const schema = z.object({
  enabled: z.boolean().optional(),
  announcement: z.string().max(400).optional(),
  by: z.string().min(1).optional()
});

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const period = await getKitOrderingPeriod();
  return NextResponse.json({ period });
}

export async function POST(req: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(jsonMessage("Expected JSON body."), { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }
  const by = (parsed.data.by ?? "Admin").trim() || "Admin";

  let next = await getKitOrderingPeriod();
  if (typeof parsed.data.enabled === "boolean") {
    next = await setKitOrderingEnabled({ enabled: parsed.data.enabled, by, announcement: parsed.data.announcement });
  } else if (parsed.data.announcement !== undefined) {
    next = await updateKitOrderingAnnouncement({ announcement: parsed.data.announcement, by });
  }
  revalidateAdminViews();
  revalidatePublicSite();

  return NextResponse.json({
    message: typeof parsed.data.enabled === "boolean"
      ? parsed.data.enabled
        ? "Kit ordering is now OPEN."
        : "Kit ordering has been CLOSED."
      : "Announcement updated.",
    period: next
  });
}
