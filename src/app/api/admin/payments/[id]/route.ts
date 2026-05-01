import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  getMonthlyMembershipWindow,
  isMembershipFee,
  isRegistrationFee,
  sendInvoiceIssuedEmail,
  sendOverduePaymentEmail,
  sendPaymentApprovedEmail,
  sendRegistrationDecisionEmail
} from "@/lib/notifications";
import { isDuplicateOpenInvoice, monthlyFeePaymentFor } from "@/lib/payment-guards";
import { getMonthlyFeeForGroup, loadPricing } from "@/lib/pricing-store";
import { revalidateAdminViews } from "@/lib/revalidate-admin";
import { requireAdmin } from "@/lib/require-admin";
import { jsonMessage } from "@/lib/utils";

const patchSchema = z.object({
  action: z.enum(["confirm", "mark_pending", "mark_overdue", "send_invoice"]),
  paymentMethod: z.enum(["cash", "mobile_money", "bank_transfer", "card", "other"]).optional(),
  paymentNotes: z.string().optional(),
  mobileMoneyRef: z.string().optional(),
  dueDate: z.string().optional()
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(jsonMessage("Invalid payment action payload", { issues: parsed.error.flatten() }), {
      status: 400
    });
  }
  const { id } = await params;
  const payment = await db.getPayment(id);
  if (!payment) return NextResponse.json(jsonMessage("Payment not found"), { status: 404 });
  const player = await db.getPlayer(payment.playerId);
  if (!player) return NextResponse.json(jsonMessage("Player not found"), { status: 404 });
  const parent = await db.getParentByPlayerId(player.id);

  if (parsed.data.action === "mark_pending") {
    const next = await db.updatePayment(id, {
      status: "pending",
      paymentMethod: parsed.data.paymentMethod,
      paymentNotes: parsed.data.paymentNotes,
      mobileMoneyRef: parsed.data.mobileMoneyRef
    });
    await db.addMessage({
      channel: "individual",
      playerId: player.id,
      subject: `Payment marked pending: ${payment.paymentFor}`,
      body: parsed.data.paymentNotes || "Payment proof submitted and awaiting confirmation.",
      sentBy: "Finance admin"
    });
    revalidateAdminViews();
    return NextResponse.json({ message: "Payment marked pending review", payment: next });
  }

  if (parsed.data.action === "mark_overdue") {
    const next = await db.updatePayment(id, {
      status: "overdue",
      dueDate: parsed.data.dueDate ?? payment.dueDate
    });
    if (parent?.email) {
      await sendOverduePaymentEmail({
        email: parent.email,
        parentName: parent.parentName,
        playerName: player.playerName,
        amount: payment.amount,
        currency: payment.currency,
        dueDate: next?.dueDate ?? payment.dueDate,
        paymentFor: payment.paymentFor
      });
    }
    await db.addMessage({
      channel: "individual",
      playerId: player.id,
      subject: `Payment overdue: ${payment.paymentFor}`,
      body: `Amount ${payment.amount.toLocaleString()} ${payment.currency}.`,
      sentBy: "Finance admin"
    });
    revalidateAdminViews();
    return NextResponse.json({ message: "Payment marked overdue", payment: next });
  }

  if (parsed.data.action === "send_invoice") {
    const next = await db.updatePayment(id, {
      dueDate: new Date().toISOString(),
      invoiceSentAt: new Date().toISOString()
    });
    if (parent?.email) {
      await sendInvoiceIssuedEmail({
        email: parent.email,
        parentName: parent.parentName,
        playerName: player.playerName,
        group: player.ageGroup,
        amount: payment.amount,
        currency: payment.currency,
        dueDate: next?.dueDate ?? payment.dueDate,
        description: payment.paymentFor
      });
      await db.addMessage({
        channel: "individual",
        playerId: player.id,
        subject: `Invoice issued: ${payment.paymentFor}`,
        body: `Amount ${payment.amount.toLocaleString()} ${payment.currency}, due ${(next?.dueDate ?? payment.dueDate).slice(0, 10)}.`,
        sentBy: "Finance admin"
      });
    }
    revalidateAdminViews();
    return NextResponse.json({ message: "Invoice sent", payment: next });
  }

  const verifiedBy = process.env.ADMIN_EMAIL ?? "admin@ftprlions.com";
  const verified = await db.verifyPayment(id, verifiedBy, {
    paymentMethod: parsed.data.paymentMethod,
    paymentNotes: parsed.data.paymentNotes,
    mobileMoneyRef: parsed.data.mobileMoneyRef
  });
  if (!verified) return NextResponse.json(jsonMessage("Payment not found"), { status: 404 });
  const isRegFee = isRegistrationFee(verified.paymentFor);
  const isMonthlyMembership = isMembershipFee(verified.paymentFor);
  let membership: { startsAt: string; endsAt: string } | null = null;
  if (isMonthlyMembership) {
    membership = getMonthlyMembershipWindow(verified.paidAt ?? new Date().toISOString());
    await db.updatePlayer(player.id, { subscriptionValidUntil: membership.endsAt });
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
  if (parent?.email && isMonthlyMembership && membership) {
    await sendPaymentApprovedEmail({
      email: parent.email,
      playerName: player.playerName,
      paymentFor: verified.paymentFor,
      amount: verified.amount,
      currency: verified.currency,
      paidAt: verified.paidAt,
      membershipStartsAt: membership.startsAt,
      membershipEndsAt: membership.endsAt
    });
  }
  if (parent?.email && isRegFee) {
    await sendRegistrationDecisionEmail(parent.email, player.playerName, true, player.ageGroup);
  }
  await db.addMessage({
    channel: "individual",
    playerId: player.id,
    subject: isMonthlyMembership
      ? `Monthly fee approved: ${verified.paymentFor}`
      : isRegFee
        ? `Registration payment confirmed: ${verified.paymentFor}`
        : `Payment confirmed: ${verified.paymentFor}`,
    body: `Confirmed by ${verifiedBy} on ${(verified.paidAt ?? new Date().toISOString()).slice(0, 10)}.`,
    sentBy: "Finance admin"
  });
  revalidateAdminViews();
  const paymentOut = (await db.getPayment(id)) ?? verified;
  return NextResponse.json({
    message: isMonthlyMembership
      ? "Monthly fee payment approved"
      : isRegFee
        ? "Registration payment confirmed and player admitted"
        : "Payment confirmed",
    payment: paymentOut,
    membership
  });
}
