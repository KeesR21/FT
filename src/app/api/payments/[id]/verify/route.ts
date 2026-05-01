import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  getMonthlyMembershipWindow,
  isMembershipFee,
  isRegistrationFee,
  sendInvoiceIssuedEmail,
  sendPaymentApprovedEmail,
  sendRegistrationDecisionEmail
} from "@/lib/notifications";
import { isDuplicateOpenInvoice, monthlyFeePaymentFor } from "@/lib/payment-guards";
import { getMonthlyFeeForGroup, loadPricing } from "@/lib/pricing-store";
import { canApproveRegistrations, getCurrentRole } from "@/lib/rbac";
import { jsonMessage } from "@/lib/utils";

const schema = z.object({
  paymentMethod: z.enum(["cash", "mobile_money", "bank_transfer", "card", "other"]).optional(),
  paymentNotes: z.string().optional(),
  mobileMoneyRef: z.string().optional()
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const role = await getCurrentRole();
  if (!canApproveRegistrations(role)) {
    return NextResponse.json(jsonMessage("Forbidden"), { status: 403 });
  }
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
  const adminLabel = process.env.ADMIN_EMAIL ?? "admin@ftprlions.com";
  const payment = await db.verifyPayment(id, adminLabel, {
    paymentMethod: parsed.data.paymentMethod,
    paymentNotes: parsed.data.paymentNotes,
    mobileMoneyRef: parsed.data.mobileMoneyRef
  });
  if (!payment) {
    return NextResponse.json(jsonMessage("Payment not found"), { status: 404 });
  }

  const player = await db.getPlayer(payment.playerId);
  if (player) {
    const isRegFee = isRegistrationFee(payment.paymentFor);
    const isMonthlyMembership = isMembershipFee(payment.paymentFor);
    let membershipWindow: { startsAt: string; endsAt: string } | null = null;
    if (isMonthlyMembership) {
      membershipWindow = getMonthlyMembershipWindow(payment.paidAt ?? new Date().toISOString());
      await db.updatePlayer(player.id, {
        subscriptionValidUntil: membershipWindow.endsAt
      });
    }
    if (isRegFee && player.registrationStatus !== "approved") {
      await db.updateRegistrationStatus(player.id, "approved");
    }
    if (isRegFee) {
      const pricing = await loadPricing();
      const fee = getMonthlyFeeForGroup(pricing, player.ageGroup);
      const dueDate = new Date().toISOString();
      const paymentFor = monthlyFeePaymentFor(dueDate);
      const existing = await db.listPaymentsForPlayer(player.id);
      if (!isDuplicateOpenInvoice(existing, { paymentFor, dueDate })) {
        const monthlyInvoice = await db.createPayment({
          playerId: player.id,
          amount: fee.amount,
          currency: fee.currency,
          paymentFor,
          dueDate,
          invoiceSentAt: new Date().toISOString()
        });
        const parent = await db.getParentByPlayerId(player.id);
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
    const parent = await db.getParentByPlayerId(player.id);
    if (parent?.email && isMonthlyMembership && membershipWindow) {
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
    if (parent?.email && isRegFee) {
      await sendRegistrationDecisionEmail(parent.email, player.playerName, true, player.ageGroup);
    }
    return NextResponse.json({
      message: isMonthlyMembership
        ? "Monthly fee payment approved"
        : isRegFee
          ? "Registration payment verified and player admitted"
          : "Payment verified",
      payment,
      membership: membershipWindow
    });
  }

  return NextResponse.json({ message: "Payment verified", payment });
}
