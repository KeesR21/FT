import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedAdminActor } from "@/lib/admin-actor";
import { recordActivity } from "@/lib/activity-log";
import { db } from "@/lib/db";
import { mergeRegistrationProfile } from "@/lib/registration-profile";
import { requireAdmin } from "@/lib/require-admin";
import { revalidateAdminViews } from "@/lib/revalidate-admin";
import { revalidatePublicSite } from "@/lib/revalidate-public";
import { resolveLedgerPaymentFor } from "@/lib/payment-guards";
import { getAgeGroup, jsonMessage } from "@/lib/utils";
import { isAgeGroup } from "@/lib/age-groups";

const registrationProfilePartialSchema = z
  .object({
    nationality: z.string().max(200).optional(),
    position: z.string().max(64).optional(),
    preferredFoot: z.string().max(32).optional(),
    previousClub: z.string().max(200).optional(),
    parentRelationship: z.string().max(32).optional(),
    emergencyContactName: z.string().max(120).optional(),
    emergencyContactPhone: z.string().max(40).optional(),
    medicalInfo: z.string().max(2500).optional(),
    howHeard: z.string().max(32).optional()
  })
  .optional();

const patchSchema = z.object({
  playerName: z.string().min(2).optional(),
  dateOfBirth: z.string().min(8).optional(),
  ageGroup: z.string().optional(),
  heightCm: z.number().positive().optional(),
  weightKg: z.number().positive().optional(),
  developmentNotes: z.string().optional().nullable(),
  subscriptionValidUntil: z.string().optional().nullable(),
  profilePhotoUrl: z.string().min(1).optional().nullable(),
  parentName: z.string().optional(),
  phoneNumber: z.string().optional(),
  email: z.union([z.string().email("Enter a valid parent email."), z.literal("")]).optional(),
  address: z.string().optional(),
  status: z.enum(["active", "withdrawn"]).optional(),
  registrationStatus: z.enum(["pending", "approved", "rejected"]).optional(),
  registrationProfile: registrationProfilePartialSchema
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  const player = await db.getPlayer(id);
  if (!player) return NextResponse.json(jsonMessage("Not found"), { status: 404 });
  const parent = await db.getParentByPlayerId(id);
  const payments = (await db.listPaymentsForPlayer(id)).map((pay) => ({
    ...pay,
    paymentFor: resolveLedgerPaymentFor(pay.paymentFor, pay.dueDate)
  }));
  const performance = await db.listPerformance(id);
  return NextResponse.json({ player, parent, payments, performance });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const adminActor = await getAuthenticatedAdminActor();
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(jsonMessage("Expected JSON body"), { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(jsonMessage("Invalid payload", { issues: parsed.error.flatten() }), { status: 400 });
  }
  const data = parsed.data;
  const player = await db.getPlayer(id);
  if (!player) return NextResponse.json(jsonMessage("Not found"), { status: 404 });

  const prevSnap = {
    playerName: player.playerName,
    status: player.status,
    registrationStatus: player.registrationStatus,
    subscriptionValidUntil: player.subscriptionValidUntil ?? null,
    ageGroup: player.ageGroup,
    parentEmail: (await db.getParentByPlayerId(id))?.email
  };

  const parentPatch: Record<string, string> = {};
  if (data.parentName !== undefined) parentPatch.parentName = data.parentName;
  if (data.phoneNumber !== undefined) parentPatch.phoneNumber = data.phoneNumber;
  if (data.email !== undefined && data.email !== "") parentPatch.email = data.email;
  if (data.address !== undefined) parentPatch.address = data.address;
  if (Object.keys(parentPatch).length) await db.updateParent(player.parentId, parentPatch);

  const nextDob = data.dateOfBirth ?? player.dateOfBirth;
  let nextGroup = data.ageGroup ?? player.ageGroup;
  if (data.dateOfBirth && !data.ageGroup) {
    nextGroup = getAgeGroup(data.dateOfBirth);
  }
  if (data.ageGroup && isAgeGroup(data.ageGroup)) {
    nextGroup = data.ageGroup;
  }

  const mergedProfile =
    data.registrationProfile !== undefined
      ? mergeRegistrationProfile(player.registrationProfile, data.registrationProfile)
      : undefined;

  const withdrawnPatch: { withdrawnAt?: string | null } = {};
  if (data.status !== undefined) {
    if (data.status === "withdrawn" && player.status !== "withdrawn") {
      withdrawnPatch.withdrawnAt = new Date().toISOString();
    } else if (data.status === "active") {
      withdrawnPatch.withdrawnAt = null;
    }
  }

  const updated = await db.updatePlayer(id, {
    ...(data.playerName && { playerName: data.playerName }),
    dateOfBirth: nextDob,
    ageGroup: nextGroup,
    ...(data.heightCm !== undefined && { heightCm: data.heightCm }),
    ...(data.weightKg !== undefined && { weightKg: data.weightKg }),
    ...(data.developmentNotes !== undefined && { developmentNotes: data.developmentNotes ?? undefined }),
    ...(data.subscriptionValidUntil !== undefined && {
      subscriptionValidUntil: data.subscriptionValidUntil ?? undefined
    }),
    ...(data.profilePhotoUrl !== undefined && { profilePhotoUrl: data.profilePhotoUrl ?? undefined }),
    ...(data.status !== undefined && { status: data.status }),
    ...(data.registrationStatus !== undefined && { registrationStatus: data.registrationStatus }),
    ...(Object.keys(withdrawnPatch).length > 0 && withdrawnPatch),
    ...(mergedProfile !== undefined && { registrationProfile: mergedProfile })
  });
  if (!updated) return NextResponse.json(jsonMessage("Not found"), { status: 404 });

  revalidatePublicSite();
  revalidateAdminViews();

  recordActivity(req, {
    actorKind: "admin",
    actorId: adminActor.id,
    actorLabel: adminActor.label,
    action: "player.update",
    description: `Updated player roster record: ${updated.playerName}`,
    resourceType: "player",
    resourceId: id,
    previousValue: prevSnap,
    newValue: {
      playerName: updated.playerName,
      status: updated.status,
      registrationStatus: updated.registrationStatus,
      subscriptionValidUntil: updated.subscriptionValidUntil ?? null,
      ageGroup: updated.ageGroup,
      parentEmail: (await db.getParentByPlayerId(id))?.email
    }
  });

  return NextResponse.json({ player: updated });
}
