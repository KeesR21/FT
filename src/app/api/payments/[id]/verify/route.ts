import { NextResponse } from "next/server";
import { z } from "zod";
import { recordActivity } from "@/lib/activity-log";
import { getAuthenticatedAdminActor } from "@/lib/admin-actor";
import { db } from "@/lib/db";
import { computeMonthlyMembershipWindow } from "@/lib/membership-billing";
import {
  isMembershipFee,
  isRegistrationFee,
  sendPaymentApprovedEmail
} from "@/lib/notifications";
import { requireAdmin } from "@/lib/require-admin";
import { jsonMessage } from "@/lib/utils";

const schema = z.object({
  paymentMethod: z.enum(["cash", "mobile_money", "bank_transfer", "card", "other"]).optional(),
  paymentNotes: z.string().optional(),
  mobileMoneyRef: z.string().optional()
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(jsonMessage("Invalid payload", { issues: parsed.error.flatten() }), { status: 400 });
  }

  const { id } = await params;
  const existing = await db.getPayment(id);
  if (!existing) {
    return NextResponse.json(jsonMessage("Payment not found"), { status: 404 });
  }
  if (existing.status === "paid") {
    return NextResponse.json({
      message: "Payment was already verified — no changes were made.",
      payment: existing,
      idempotent: true
    });
  }

  const player = await db.getPlayer(existing.playerId);
  const isMonthlyMembership = isMembershipFee(existing.paymentFor);
  const isRegFee = isRegistrationFee(existing.paymentFor);
  const priorValidUntil = isMonthlyMembership ? player?.subscriptionValidUntil ?? null : null;

  const actor = await getAuthenticatedAdminActor();
  const adminLabel = actor.label;
  const payment = await db.verifyPayment(id, adminLabel, {
    paymentMethod: parsed.data.paymentMethod,
    paymentNotes: parsed.data.paymentNotes,
    mobileMoneyRef: parsed.data.mobileMoneyRef
  });
  if (!payment) {
    return NextResponse.json(jsonMessage("Payment not found"), { status: 404 });
  }

  let membershipWindow: { startsAt: string; endsAt: string } | null = null;
  if (player && isMonthlyMembership) {
    membershipWindow = computeMonthlyMembershipWindow({
      paidAt: payment.paidAt ?? new Date().toISOString(),
      priorValidUntil
    });
    await db.updatePlayer(player.id, { subscriptionValidUntil: membershipWindow.endsAt });

    const parent = await db.getParentByPlayerId(player.id);
    if (parent?.email) {
      await sendPaymentApprovedEmail({
        email: parent.email,
        playerName: player.playerName,
        paymentFor: payment.paymentFor,
        amount: payment.amount,
        currency: payment.currency,
        paidAt: payment.paidAt,
        membershipStartsAt: membershipWindow.startsAt,
        membershipEndsAt: membershipWindow.endsAt
      });
    }
  }

  recordActivity(req, {
    actorKind: "admin",
    actorId: actor.id,
    actorLabel: actor.label,
    action: "payment.verify",
    description: `Marked payment as paid (${payment.paymentFor ?? "fee"}) for player ${payment.playerId}`,
    resourceType: "payment",
    resourceId: id,
    previousValue: {
      status: existing.status,
      amount: existing.amount,
      currency: existing.currency,
      paymentFor: existing.paymentFor
    },
    newValue: {
      status: payment.status,
      paidAt: payment.paidAt,
      verifiedBy: payment.verifiedBy,
      paymentMethod: payment.paymentMethod
    }
  });

  return NextResponse.json({
    message: isMonthlyMembership
      ? "Monthly fee payment approved"
      : isRegFee
        ? "Registration payment verified. Open Applications to admit the player."
        : "Payment verified",
    payment,
    membership: membershipWindow
  });
}
