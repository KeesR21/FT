import Link from "next/link";
import { redirect } from "next/navigation";
import { OrderClient } from "./order-client";
import { getKitOrderingPeriod } from "@/lib/kit-period-store";
import { listKits } from "@/lib/kit-store";
import { findLinkedPlayersByEmail } from "@/lib/portal-linked-players";
import { getCurrentPortalAccount } from "@/lib/portal-auth";

export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await params;
  const account = await getCurrentPortalAccount();
  if (!account) redirect(`/portal/login?next=${encodeURIComponent(`/portal/order/${playerId}`)}`);

  const [linked, period, kits] = await Promise.all([
    findLinkedPlayersByEmail(account.email),
    getKitOrderingPeriod(),
    listKits()
  ]);

  const target = linked.players.find((lp) => lp.player.id === playerId);
  if (!target) {
    return (
      <div className="portal-dashboard">
        <p className="portal-empty">That player is not linked to your account. <Link href="/portal/dashboard">Back to dashboard</Link></p>
      </div>
    );
  }

  if (!period.enabled) {
    return (
      <div className="portal-dashboard">
        <header className="portal-dashboard-hero">
          <div>
            <p className="portal-dashboard-eyebrow">Kit ordering</p>
            <h1 className="portal-dashboard-title">Ordering window is closed</h1>
            <p className="portal-dashboard-sub">Please check back when the next ordering window opens.</p>
          </div>
        </header>
        <p>
          <Link href="/portal/dashboard" className="btn portal-btn portal-btn--primary">Back to dashboard</Link>
        </p>
      </div>
    );
  }

  const paymentInstructions =
    process.env.KIT_PAYMENT_INSTRUCTIONS ??
    "After submitting, transfer the total amount in RWF via Mobile Money (MTN MoMo / Airtel Money) to the FTPR Lions academy line. Use your child’s name as the payment reference, then our admin team will confirm and approve.";

  return (
    <OrderClient
      player={{
        id: target.player.id,
        name: target.player.playerName,
        ageGroup: target.player.ageGroup
      }}
      kits={kits.map((k) => ({
        id: k.id,
        type: k.type,
        color: k.color,
        description: k.description,
        sizes: k.sizes,
        price: k.price,
        currency: k.currency,
        photoUrl: k.photoUrl
      }))}
      paymentInstructions={paymentInstructions}
    />
  );
}
