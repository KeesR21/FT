import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
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
