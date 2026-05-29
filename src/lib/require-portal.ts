import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  clearSessionToken,
  isPortalAccountIdleExpired,
  touchPortalAccountActivity,
  type ParentAccount
} from "@/lib/parent-account-store";
import { getCurrentPortalAccount, PORTAL_COOKIE, portalCookieOptions } from "@/lib/portal-auth";
import { jsonMessage } from "@/lib/utils";

export async function requirePortalAccount(): Promise<
  | { ok: true; account: ParentAccount }
  | { ok: false; response: NextResponse }
> {
  const account = await getCurrentPortalAccount();
  if (!account) {
    return { ok: false, response: NextResponse.json(jsonMessage("Unauthorized"), { status: 401 }) };
  }

  if (isPortalAccountIdleExpired(account)) {
    await clearSessionToken(account.id);
    const store = await cookies();
    store.set(PORTAL_COOKIE, "", portalCookieOptions({ clear: true }));
    return {
      ok: false,
      response: NextResponse.json(jsonMessage("Session expired due to inactivity. Please sign in again."), {
        status: 401
      })
    };
  }

  await touchPortalAccountActivity(account.id);
  return { ok: true, account };
}
