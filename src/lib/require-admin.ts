import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  clearAdminSession,
  isAdminSessionIdleExpired,
  touchAdminSessionActivity
} from "@/lib/admin-credential-store";
import { ADMIN_COOKIE, adminSessionCookieOptions, isValidSessionToken } from "@/lib/auth";
import { jsonMessage } from "@/lib/utils";

export async function requireAdmin(): Promise<NextResponse | null> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!(await isValidSessionToken(token))) {
    return NextResponse.json(jsonMessage("Unauthorized"), { status: 401 });
  }

  if (await isAdminSessionIdleExpired()) {
    await clearAdminSession();
    // Route Handler — allowed to write cookies
    store.set(ADMIN_COOKIE, "", adminSessionCookieOptions({ clear: true }));
    return NextResponse.json(
      jsonMessage("Session expired due to inactivity. Please sign in again."),
      { status: 401 }
    );
  }

  await touchAdminSessionActivity();

  // Slide the cookie expiry forward on every authenticated API request so active
  // admins are never logged out mid-session (30-minute sliding window).
  if (token) {
    store.set(ADMIN_COOKIE, token, adminSessionCookieOptions());
  }

  return null;
}
