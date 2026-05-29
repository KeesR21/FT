import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedAdminActor } from "@/lib/admin-actor";
import { recordActivity } from "@/lib/activity-log";
import { createKit, listKits } from "@/lib/kit-store";
import { requireAdmin } from "@/lib/require-admin";
import { revalidateAdminViews } from "@/lib/revalidate-admin";
import { revalidatePublicSite } from "@/lib/revalidate-public";
import { jsonMessage } from "@/lib/utils";

const createSchema = z.object({
  type: z.string().trim().min(2, "Kit type is required."),
  color: z.string().trim().min(1, "Colour is required."),
  description: z.string().trim().max(800).optional(),
  sizes: z.array(z.string().trim().min(1)).min(1, "Add at least one size."),
  photoUrl: z.string().trim().min(1).optional(),
  price: z.number().nonnegative("Price cannot be negative."),
  currency: z.string().trim().min(2).max(8).default("RWF"),
  active: z.boolean().default(true)
});

export async function GET(req: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const { searchParams } = new URL(req.url);
  const includeInactive = searchParams.get("includeInactive") === "1";
  const kits = await listKits({ includeInactive });
  return NextResponse.json({ kits });
}

export async function POST(req: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const adminActor = await getAuthenticatedAdminActor();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(jsonMessage("Expected JSON body."), { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid kit." },
      { status: 400 }
    );
  }
  const kit = await createKit({
    type: parsed.data.type,
    color: parsed.data.color,
    description: parsed.data.description,
    sizes: parsed.data.sizes,
    photoUrl: parsed.data.photoUrl,
    price: parsed.data.price,
    currency: parsed.data.currency,
    active: parsed.data.active,
    createdBy: adminActor.label
  });
  revalidateAdminViews();
  revalidatePublicSite();
  recordActivity(req, {
    actorKind: "admin",
    actorId: adminActor.id,
    actorLabel: adminActor.label,
    action: "kit.create",
    description: `Created kit catalog item: ${kit.type} — ${kit.color}`,
    resourceType: "kit",
    resourceId: kit.id,
    newValue: { type: kit.type, color: kit.color, price: kit.price, active: kit.active }
  });
  return NextResponse.json({ message: "Kit added.", kit });
}
