import { NextResponse } from "next/server";
import { z } from "zod";
import { acknowledgeNotification, getOrder } from "@/lib/kit-order-store";
import { requirePortalAccount } from "@/lib/require-portal";
import { jsonMessage } from "@/lib/utils";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requirePortalAccount();
  if (!gate.ok) return gate.response;
  const { account } = gate;
  const { id } = await ctx.params;
  const order = await getOrder(id);
  if (!order || order.accountId !== account.id) {
    return NextResponse.json({ message: "Order not found." }, { status: 404 });
  }
  return NextResponse.json({ order });
}

const patchSchema = z.object({
  acknowledgeNotification: z.boolean().optional()
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requirePortalAccount();
  if (!gate.ok) return gate.response;
  const { account } = gate;
  const { id } = await ctx.params;
  const order = await getOrder(id);
  if (!order || order.accountId !== account.id) {
    return NextResponse.json({ message: "Order not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(jsonMessage("Expected JSON body."), { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  if (parsed.data.acknowledgeNotification) {
    const updated = await acknowledgeNotification(id);
    return NextResponse.json({ order: updated ?? order });
  }
  return NextResponse.json({ order });
}
