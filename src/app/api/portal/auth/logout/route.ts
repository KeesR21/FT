import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { recordActivity } from "@/lib/activity-log";
import { clearSessionToken } from "@/lib/parent-account-store";
import { getCurrentPortalAccount, PORTAL_COOKIE, portalCookieOptions } from "@/lib/portal-auth";

export async function POST(req: Request) {
  const account = await getCurrentPortalAccount();
  if (account) {
    recordActivity(req, {
      actorKind: "parent",
      actorId: account.id,
      actorLabel: account.email,
      action: "parent.logout",
      description: "Parent signed out of the portal"
    });
    await clearSessionToken(account.id);
  }
  const store = await cookies();
  store.set(PORTAL_COOKIE, "", portalCookieOptions({ clear: true }));
  return NextResponse.json({ message: "Signed out." });
}
