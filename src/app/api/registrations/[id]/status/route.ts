import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedAdminActor } from "@/lib/admin-actor";
import { recordActivity } from "@/lib/activity-log";
import { db } from "@/lib/db";
import { sendInvoiceIssuedEmail, sendRegistrationDecisionEmail } from "@/lib/notifications";
import {
  canCreateNewMonthlyInvoice,
  monthlyFeePaymentFor
} from "@/lib/payment-guards";
import { getMonthlyFeeForGroup, loadPricing } from "@/lib/pricing-store";
import { requireAdmin } from "@/lib/require-admin";
import { revalidateAdminViews } from "@/lib/revalidate-admin";
import { revalidatePublicSite } from "@/lib/revalidate-public";
import { jsonMessage } from "@/lib/utils";

const schema = z.object({ status: z.enum(["approved", "rejected"]) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const adminActor = await getAuthenticatedAdminActor();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(jsonMessage("Expected JSON body"), { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(jsonMessage("Invalid status"), { status: 400 });
  }

  const { id } = await params;
  const current = await db.getPlayer(id);
  if (!current) {
    return NextResponse.json(jsonMessage("Player not found"), { status: 404 });
  }
  if (parsed.data.status === current.registrationStatus) {
    recordActivity(req, {
      actorKind: "admin",
      actorId: adminActor.id,
      actorLabel: adminActor.label,
      action: "registration.status",
      description: `Registration decision no-op (${current.registrationStatus}) for ${current.playerName}`,
      resourceType: "player",
      resourceId: id,
      previousValue: { registrationStatus: current.registrationStatus },
      newValue: { idempotent: true }
    });
    return NextResponse.json({
      message: `Player is already ${current.registrationStatus} — no changes were made.`,
      player: current,
      idempotent: true
    });
  }

  if (parsed.data.status === "approved") {
    const existingPayments = await db.listPaymentsForPlayer(id);
    const hasPaidRegistration = existingPayments.some(
      (p) => /registration fee/i.test(p.paymentFor) && p.status === "paid"
    );
    if (!hasPaidRegistration) {
      return NextResponse.json(
        jsonMessage("Registration fee must be paid and confirmed before admission."),
        { status: 409 }
      );
    }
  }
  const player = await db.updateRegistrationStatus(id, parsed.data.status);
  if (!player) {
    return NextResponse.json(jsonMessage("Player not found"), { status: 404 });
  }

  const parent = await db.getParentByPlayerId(player.id);
  if (parent) {
    await sendRegistrationDecisionEmail(
      parent.email,
      player.playerName,
      parsed.data.status === "approved",
      parsed.data.status === "approved" ? player.ageGroup : undefined
    );
  }
  if (parsed.data.status === "approved") {
    const pricing = await loadPricing();
    const fee = getMonthlyFeeForGroup(pricing, player.ageGroup);
    const dueDate = new Date().toISOString();
    const paymentFor = monthlyFeePaymentFor(dueDate);
    const existing = await db.listPaymentsForPlayer(player.id);
    const guard = canCreateNewMonthlyInvoice({ player, payments: existing, dueDate });
    if (guard.ok) {
      const monthlyInvoice = await db.createPayment({
        playerId: player.id,
        amount: fee.amount,
        currency: fee.currency,
        paymentFor,
        dueDate,
        invoiceSentAt: new Date().toISOString()
      });
      if (parent?.email) {
        await sendInvoiceIssuedEmail({
          email: parent.email,
          parentName: parent.parentName,
          playerName: player.playerName,
          group: player.ageGroup,
          amount: monthlyInvoice.amount,
          currency: monthlyInvoice.currency,
          dueDate: monthlyInvoice.dueDate,
          description: monthlyInvoice.paymentFor
        });
      }
    }
  }

  revalidatePublicSite();
  revalidateAdminViews();

  recordActivity(req, {
    actorKind: "admin",
    actorId: adminActor.id,
    actorLabel: adminActor.label,
    action: "registration.status",
    description:
      parsed.data.status === "approved"
        ? `Approved registration for ${player.playerName}`
        : `Rejected registration for ${player.playerName}`,
    resourceType: "player",
    resourceId: id,
    previousValue: { registrationStatus: current.registrationStatus },
    newValue: { registrationStatus: player.registrationStatus }
  });

  return NextResponse.json({
    message:
      parsed.data.status === "approved"
        ? "Player admitted. Monthly membership invoice is now waiting for the parent to pay."
        : "Application declined.",
    player
  });
}
