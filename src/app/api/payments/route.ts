import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  canCreateNewMonthlyInvoice,
  isDuplicateOpenInvoice,
  LEDGER_REGISTRATION_FEE_LABEL,
  monthlyFeePaymentFor
} from "@/lib/payment-guards";
import { requireAdmin } from "@/lib/require-admin";
import { jsonMessage } from "@/lib/utils";

const schema = z.object({
  playerId: z.string().min(1),
  amount: z.coerce.number().positive(),
  lineKind: z.enum(["registration", "monthly"]),
  dueDate: z.string().min(8),
  mobileMoneyRef: z.string().optional()
});

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  return NextResponse.json({ payments: await db.listPayments() });
}

export async function POST(req: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(jsonMessage("Expected JSON payload"), { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(jsonMessage("Invalid payment payload", { issues: parsed.error.flatten() }), { status: 400 });
  }
  const player = await db.getPlayer(parsed.data.playerId);
  if (!player) {
    return NextResponse.json(jsonMessage("Player not found"), { status: 404 });
  }
  const dueDateIso = new Date(parsed.data.dueDate).toISOString();
  const ledgerPaymentFor =
    parsed.data.lineKind === "registration"
      ? LEDGER_REGISTRATION_FEE_LABEL
      : monthlyFeePaymentFor(dueDateIso);
  const existing = await db.listPaymentsForPlayer(parsed.data.playerId);
  if (parsed.data.lineKind === "monthly") {
    const guard = canCreateNewMonthlyInvoice({ player, payments: existing, dueDate: dueDateIso });
    if (!guard.ok) {
      return NextResponse.json(
        jsonMessage(
          guard.reason === "open_monthly_invoice_exists"
            ? "Player already has an open monthly invoice. Resolve it before creating another."
            : guard.reason === "active_subscription_not_renewable_yet"
              ? "Player still has an active monthly subscription — wait until the last 3 days before renewing."
              : "Open monthly invoice already exists for this period.",
          { code: "MONTHLY_INVOICE_BLOCKED", reason: guard.reason, existing: "existing" in guard ? guard.existing : null }
        ),
        { status: 409 }
      );
    }
  } else {
    const duplicate = isDuplicateOpenInvoice(existing, {
      paymentFor: ledgerPaymentFor,
      dueDate: dueDateIso
    });
    if (duplicate) {
      return NextResponse.json(
        jsonMessage("Duplicate unpaid/pending invoice exists for same month and description", { payment: duplicate }),
        { status: 409 }
      );
    }
  }

  const payment = await db.createPayment({
    playerId: parsed.data.playerId,
    amount: parsed.data.amount,
    currency: "RWF",
    paymentFor: ledgerPaymentFor,
    dueDate: dueDateIso,
    mobileMoneyRef: parsed.data.mobileMoneyRef
  });

  return NextResponse.json({ message: "Payment request submitted", payment }, { status: 201 });
}
