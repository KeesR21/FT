import { NextResponse } from "next/server";
import { computeKitFinanceInsights, computeKitFinanceSummary, deriveKitOrderFinancials } from "@/lib/kit-order-finance";
import { listOrders } from "@/lib/kit-order-store";
import { requireAdmin } from "@/lib/require-admin";

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const orders = await listOrders({ status: "all" });
  const summary = computeKitFinanceSummary(orders);
  const insights = computeKitFinanceInsights(orders);
  const mismatchedReferences = orders
    .filter((o) => deriveKitOrderFinancials(o).totalsMismatch)
    .map((o) => o.reference);

  return NextResponse.json({
    orders,
    summary,
    insights,
    mismatchedReferences
  });
}
