import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { jsonMessage } from "@/lib/utils";

const schema = z.object({
  proofUrl: z.string().url().optional(),
  reference: z.string().min(2).optional(),
  notes: z.string().min(2).optional(),
  paymentMethod: z.enum(["cash", "mobile_money", "bank_transfer", "card", "other"]).optional()
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(jsonMessage("Expected JSON payload"), { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(jsonMessage("Invalid proof payload", { issues: parsed.error.flatten() }), { status: 400 });
  }
  if (!parsed.data.proofUrl && !parsed.data.reference && !parsed.data.notes) {
    return NextResponse.json(jsonMessage("Provide at least proof URL, reference, or notes"), { status: 400 });
  }
  const { id } = await params;
  const payment = await db.getPayment(id);
  if (!payment) return NextResponse.json(jsonMessage("Payment not found"), { status: 404 });
  if (payment.status === "paid") {
    return NextResponse.json(jsonMessage("Payment already confirmed"), { status: 400 });
  }
  const next = await db.updatePayment(id, {
    status: "pending",
    proofUrl: parsed.data.proofUrl,
    mobileMoneyRef: parsed.data.reference,
    paymentNotes: parsed.data.notes,
    paymentMethod: parsed.data.paymentMethod
  });
  return NextResponse.json({ message: "Proof submitted. Awaiting admin review.", payment: next });
}
