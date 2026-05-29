import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { computeMonthlyMembershipWindow } from "@/lib/membership-billing";
import {
  isMembershipFee,
  isRegistrationFee,
  sendInvoiceIssuedEmail,
  sendOverduePaymentEmail,
  sendPaymentApprovedEmail
} from "@/lib/notifications";
import { revalidateAdminViews } from "@/lib/revalidate-admin";
import { requireAdmin } from "@/lib/require-admin";
import { jsonMessage } from "@/lib/utils";

const patchSchema = z.object({
  action: z.enum(["confirm", "mark_pending", "mark_overdue", "send_invoice", "void"]),
  paymentMethod: z.enum(["cash", "mobile_money", "bank_transfer", "card", "other"]).optional(),
  paymentNotes: z.string().optional(),
  mobileMoneyRef: z.string().optional(),
  dueDate: z.string().optional(),
  voidReason: z.string().trim().min(3).max(280).optional()
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
    if (payment.status === "paid") {
      return NextResponse.json(jsonMessage("Payment is already paid — cannot move back to pending review."), {
        status: 409
      });
    }
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
    if (payment.status === "paid") {
      return NextResponse.json(jsonMessage("Payment is already paid — cannot mark overdue."), { status: 409 });
    }
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

  if (parsed.data.action === "void") {
    if (payment.status === "paid") {
      return NextResponse.json(
        jsonMessage("Cannot void a paid invoice. Use a refund/adjustment workflow instead."),
        { status: 409 }
      );
    }
    const reason = parsed.data.voidReason?.trim() || "Voided by admin (no reason provided).";
    const stamp = new Date().toISOString();
    const next = await db.updatePayment(id, {
      status: "overdue",
      paymentNotes: `[VOIDED ${stamp.slice(0, 10)}] ${reason}\n${payment.paymentNotes ?? ""}`.trim(),
      dueDate: payment.dueDate
    });
    await db.addMessage({
      channel: "individual",
      playerId: player.id,
      subject: `Invoice voided: ${payment.paymentFor}`,
      body: reason,
      sentBy: "Finance admin"
    });
    revalidateAdminViews();
    return NextResponse.json({
      message: "Invoice voided. It will no longer block new monthly invoices for this player.",
      payment: next
    });
  }

  if (parsed.data.action === "send_invoice") {
    if (payment.status === "paid") {
      return NextResponse.json(
        jsonMessage("This invoice is already paid — no reminder needed."),
        { status: 409 }
      );
    }
    const next = await db.updatePayment(id, {
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
        dueDate: payment.dueDate,
        description: payment.paymentFor
      });
      await db.addMessage({
        channel: "individual",
        playerId: player.id,
        subject: `Invoice reminder: ${payment.paymentFor}`,
        body: `Reminder for ${payment.amount.toLocaleString()} ${payment.currency}, original due ${payment.dueDate.slice(0, 10)}.`,
        sentBy: "Finance admin"
      });
    }
    revalidateAdminViews();
    return NextResponse.json({ message: "Reminder sent", payment: next });
  }

  if (payment.status === "paid") {
    return NextResponse.json({
      message: "Payment was already approved — no changes were made.",
      payment,
      idempotent: true
    });
  }

  const isRegFee = isRegistrationFee(payment.paymentFor);
  const isMonthlyMembership = isMembershipFee(payment.paymentFor);

  const priorValidUntil = isMonthlyMembership ? player.subscriptionValidUntil ?? null : null;
  const verifiedBy = process.env.ADMIN_EMAIL ?? "admin@ftprlions.com";
  const verified = await db.verifyPayment(id, verifiedBy, {
    paymentMethod: parsed.data.paymentMethod,
    paymentNotes: parsed.data.paymentNotes,
    mobileMoneyRef: parsed.data.mobileMoneyRef
  });
  if (!verified) return NextResponse.json(jsonMessage("Payment not found"), { status: 404 });

  let membership: { startsAt: string; endsAt: string } | null = null;
  if (isMonthlyMembership) {
    membership = computeMonthlyMembershipWindow({
      paidAt: verified.paidAt ?? new Date().toISOString(),
      priorValidUntil
    });
    await db.updatePlayer(player.id, { subscriptionValidUntil: membership.endsAt });
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

  await db.addMessage({
    channel: "individual",
    playerId: player.id,
    subject: isMonthlyMembership
      ? `Monthly fee approved: ${verified.paymentFor}`
      : isRegFee
        ? `Registration payment confirmed: ${verified.paymentFor}`
        : `Payment confirmed: ${verified.paymentFor}`,
    body: isRegFee
      ? `Confirmed by ${verifiedBy} on ${(verified.paidAt ?? new Date().toISOString()).slice(0, 10)}. Player is now waiting for admin admission.`
      : `Confirmed by ${verifiedBy} on ${(verified.paidAt ?? new Date().toISOString()).slice(0, 10)}.`,
    sentBy: "Finance admin"
  });
  revalidateAdminViews();
  const paymentOut = (await db.getPayment(id)) ?? verified;
  return NextResponse.json({
    message: isMonthlyMembership
      ? "Monthly fee payment approved"
      : isRegFee
        ? "Registration payment confirmed. Open Applications to admit the player."
        : "Payment confirmed",
    payment: paymentOut,
    membership
  });
}
