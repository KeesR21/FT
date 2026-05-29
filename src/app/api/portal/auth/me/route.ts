import { NextResponse } from "next/server";
import { listOrders } from "@/lib/kit-order-store";
import { getKitOrderingPeriod } from "@/lib/kit-period-store";
import { findLinkedPlayersByEmail } from "@/lib/portal-linked-players";
import { getCurrentPortalAccount } from "@/lib/portal-auth";

export async function GET() {
  const account = await getCurrentPortalAccount();
  if (!account) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const linked = await findLinkedPlayersByEmail(account.email);
  const orders = await listOrders({ accountId: account.id });
  const period = await getKitOrderingPeriod();

  return NextResponse.json({
    authenticated: true,
    account: {
      id: account.id,
      email: account.email,
      fullName: account.fullName,
      lastLoginAt: account.lastLoginAt,
      hasPassword: Boolean(account.passwordHash)
    },
    parents: linked.parents.map((p) => ({
      id: p.id,
      parentName: p.parentName,
      email: p.email,
      phoneNumber: p.phoneNumber
    })),
    players: linked.players.map(({ player, parent }) => ({
      id: player.id,
      playerName: player.playerName,
      ageGroup: player.ageGroup,
      registrationStatus: player.registrationStatus,
      status: player.status,
      profilePhotoUrl: player.profilePhotoUrl,
      parentId: parent.id,
      parentName: parent.parentName,
      subscriptionValidUntil: player.subscriptionValidUntil ?? null
    })),
    period: {
      enabled: period.enabled,
      announcement: period.announcement
    },
    activeNotifications: orders
      .filter((o) => o.parentNotification && !o.parentNotification.acknowledgedAt)
      .map((o) => ({
        orderId: o.id,
        reference: o.reference,
        kind: o.parentNotification!.kind,
        message: o.parentNotification!.message,
        issuedAt: o.parentNotification!.issuedAt
      }))
  });
}
