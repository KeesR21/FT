import { NextResponse } from "next/server";
import { listOrders } from "@/lib/kit-order-store";
import { requireAdmin } from "@/lib/require-admin";

export async function GET(req: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status") ?? "all";

  /** Full list — counts must reflect the whole queue, not the active tab filter. */
  const all = await listOrders({ status: "all" });
  const counts = {
    total: all.length,
    pending: all.filter((o) => o.status === "pending_payment_approval").length,
    approved: all.filter((o) => o.status === "approved").length,
    rejected: all.filter((o) => o.status === "rejected").length,
    cancelled: all.filter((o) => o.status === "cancelled").length
  };

  let orders = all;
  if (statusParam !== "all") {
    orders = all.filter((o) => o.status === statusParam);
  }

  return NextResponse.json({ orders, counts });
}
