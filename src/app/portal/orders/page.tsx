import Link from "next/link";
import { redirect } from "next/navigation";
import { OrdersListClient } from "./orders-list-client";
import { listOrders } from "@/lib/kit-order-store";
import { getCurrentPortalAccount } from "@/lib/portal-auth";

export const dynamic = "force-dynamic";

export default async function PortalOrdersPage({
  searchParams
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const account = await getCurrentPortalAccount();
  if (!account) redirect("/portal/login");
  const orders = await listOrders({ accountId: account.id });
  const sp = await searchParams;
  return (
    <div className="portal-dashboard">
      <header className="portal-dashboard-hero">
        <div>
          <p className="portal-dashboard-eyebrow">My orders</p>
          <h1 className="portal-dashboard-title">Kit order history</h1>
          <p className="portal-dashboard-sub">
            Track every order you’ve submitted. We’ll email you and post a portal notice when payment is approved.
          </p>
        </div>
        <Link href="/portal/dashboard" className="btn portal-btn portal-btn--ghost">
          Back to dashboard
        </Link>
      </header>
      <OrdersListClient orders={orders} submittedReference={sp.submitted ?? null} />
    </div>
  );
}
