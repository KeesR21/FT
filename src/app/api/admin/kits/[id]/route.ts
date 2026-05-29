import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedAdminActor } from "@/lib/admin-actor";
import { recordActivity } from "@/lib/activity-log";
import { archiveKit, getKit, updateKit } from "@/lib/kit-store";
import { requireAdmin } from "@/lib/require-admin";
import { revalidateAdminViews } from "@/lib/revalidate-admin";
import { revalidatePublicSite } from "@/lib/revalidate-public";
import { jsonMessage } from "@/lib/utils";

const patchSchema = z.object({
  type: z.string().trim().min(2).optional(),
  color: z.string().trim().min(1).optional(),
  description: z.string().trim().max(800).optional(),
  sizes: z.array(z.string().trim().min(1)).min(1).optional(),
  photoUrl: z.string().trim().optional(),
  price: z.number().nonnegative().optional(),
  currency: z.string().trim().min(2).max(8).optional(),
  active: z.boolean().optional(),
  updatedBy: z.string().trim().optional()
});

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const { id } = await ctx.params;
  const kit = await getKit(id);
  if (!kit) return NextResponse.json(jsonMessage("Kit not found."), { status: 404 });
  return NextResponse.json({ kit });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const adminActor = await getAuthenticatedAdminActor();
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(jsonMessage("Expected JSON body."), { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid update." },
      { status: 400 }
    );
  }
  const before = await getKit(id);
  const updated = await updateKit(id, { ...parsed.data, updatedBy: adminActor.label });
  if (!updated) return NextResponse.json(jsonMessage("Kit not found."), { status: 404 });
  revalidateAdminViews();
  revalidatePublicSite();
  recordActivity(req, {
    actorKind: "admin",
    actorId: adminActor.id,
    actorLabel: adminActor.label,
    action: "kit.update",
    description: `Updated kit ${updated.type} — ${updated.color}`,
    resourceType: "kit",
    resourceId: id,
    previousValue: before
      ? { type: before.type, color: before.color, price: before.price, active: before.active, sizes: before.sizes }
      : null,
    newValue: { type: updated.type, color: updated.color, price: updated.price, active: updated.active, sizes: updated.sizes }
  });
  return NextResponse.json({ message: "Kit updated.", kit: updated });
}

/** Soft-archive only — kit rows and photos are kept for order / payment history. */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const adminActor = await getAuthenticatedAdminActor();
  const { id } = await ctx.params;
  const prior = await getKit(id);
  const kit = await archiveKit(id);
  if (!kit) return NextResponse.json(jsonMessage("Kit not found."), { status: 404 });
  revalidateAdminViews();
  revalidatePublicSite();
  recordActivity(req, {
    actorKind: "admin",
    actorId: adminActor.id,
    actorLabel: adminActor.label,
    action: "kit.archive",
    description: `Archived kit ${kit.type} — ${kit.color} (retained for order history)`,
    resourceType: "kit",
    resourceId: id,
    previousValue: prior ? { active: prior.active, archivedAt: prior.archivedAt } : null,
    newValue: { active: kit.active, archivedAt: kit.archivedAt }
  });
  return NextResponse.json({
    message: "Kit archived. The catalog entry and files are kept for historical orders and finance records.",
    kit
  });
}
