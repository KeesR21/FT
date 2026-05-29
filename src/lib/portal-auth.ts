import { cookies } from "next/headers";
import type { ParentAccount } from "@/lib/parent-account-store";
import { getAccountById, getAccountByToken } from "@/lib/parent-account-store";

export const PORTAL_COOKIE = "academy_portal_session";
const COOKIE_TTL_DAYS = 30;

/**
 * Returns the current portal account based on the parent session cookie, or null.
 * The session cookie value is the rotating token stored on the parent account.
 */
export async function getCurrentPortalAccount(): Promise<ParentAccount | null> {
  const store = await cookies();
  const value = store.get(PORTAL_COOKIE)?.value;
  if (!value) return null;
  // Token can be either "<accountId>:<token>" or just "<token>".
  const [maybeId, maybeToken] = value.includes(":") ? value.split(":", 2) : [null, value];
  let account: ParentAccount | null = null;
  if (maybeId) account = await getAccountById(maybeId);
  if (account && account.sessionToken && maybeToken && account.sessionToken === maybeToken) {
    return account;
  }
  // Fallback: look up by token alone (older cookies).
  return getAccountByToken(maybeToken ?? value);
}

export function buildPortalCookieValue(accountId: string, token: string): string {
  return `${accountId}:${token}`;
}

export function portalCookieOptions(opts?: { clear?: boolean }) {
  const isSecure = process.env.NODE_ENV === "production";
  if (opts?.clear) {
    return {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax" as const,
      path: "/",
      maxAge: 0
    };
  }
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: COOKIE_TTL_DAYS * 24 * 60 * 60
  };
}
