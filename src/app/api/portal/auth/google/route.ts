import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { recordActivity } from "@/lib/activity-log";
import {
  createAccount,
  getAccountByEmail,
  rotateSessionToken,
  updateAccount
} from "@/lib/parent-account-store";
import { findLinkedPlayersByEmail } from "@/lib/portal-linked-players";
import { buildPortalCookieValue, PORTAL_COOKIE, portalCookieOptions } from "@/lib/portal-auth";
import { NO_RECORD_ERROR } from "@/lib/portal-errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/request-ip";
import { jsonMessage } from "@/lib/utils";

const schema = z.object({
  credential: z.string().min(10, "Missing Google credential.")
});

type GoogleTokenInfo = {
  iss?: string;
  azp?: string;
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  exp?: string | number;
  error_description?: string;
};

/**
 * Verify a Google ID token via the public tokeninfo endpoint. We avoid pulling
 * in `google-auth-library` to keep dependencies lean for a feature that ships
 * disabled by default until GOOGLE_CLIENT_ID is configured.
 */
async function verifyGoogleIdToken(credential: string): Promise<GoogleTokenInfo | null> {
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, {
      cache: "no-store"
    });
    if (!res.ok) return null;
    const data = (await res.json()) as GoogleTokenInfo;
    return data;
  } catch {
    return null;
  }
}

const GOOGLE_WINDOW_MS = 15 * 60 * 1000;
const GOOGLE_MAX_PER_IP = 40;

export async function POST(req: Request) {
  const ip = getRequestIp(req);
  const rl = checkRateLimit(`portal-google:${ip}`, GOOGLE_MAX_PER_IP, GOOGLE_WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      { message: "Too many sign-in attempts. Please try again later.", retryAfterSec: rl.retryAfterSec },
      { status: 429 }
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { message: "Google sign-in is not configured. Please use email and password." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(jsonMessage("Expected JSON body."), { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  const info = await verifyGoogleIdToken(parsed.data.credential);
  if (!info || !info.email || !info.sub) {
    return NextResponse.json({ message: "Could not verify Google sign-in. Please try again." }, { status: 401 });
  }
  if (info.aud !== clientId) {
    return NextResponse.json({ message: "Google sign-in token not issued for this site." }, { status: 401 });
  }
  const verified = info.email_verified === true || info.email_verified === "true";
  if (!verified) {
    return NextResponse.json({ message: "Your Google email is not verified." }, { status: 401 });
  }

  const linked = await findLinkedPlayersByEmail(info.email);
  if (linked.parents.length === 0) {
    recordActivity(req, {
      actorKind: "parent",
      actorId: info.email.toLowerCase(),
      actorLabel: info.email,
      action: "parent.login.failure",
      description: "Google sign-in blocked: no linked academy records",
      metadata: { reason: "no_linked_parent", method: "google" }
    });
    return NextResponse.json({ message: NO_RECORD_ERROR }, { status: 403 });
  }

  let account = await getAccountByEmail(info.email);
  if (!account) {
    account = await createAccount({
      email: info.email,
      fullName: info.name || info.email,
      googleSubject: info.sub
    });
  } else if (!account.googleSubject) {
    const updated = await updateAccount(account.id, { googleSubject: info.sub });
    if (updated) account = updated;
  }

  const rotated = await rotateSessionToken(account.id);
  if (!rotated) {
    recordActivity(req, {
      actorKind: "parent",
      actorId: account.id,
      actorLabel: account.email,
      action: "parent.login.failure",
      description: "Google sign-in failed: could not start session",
      metadata: { method: "google" }
    });
    return NextResponse.json({ message: "Could not start a session. Please retry." }, { status: 500 });
  }

  const store = await cookies();
  store.set(PORTAL_COOKIE, buildPortalCookieValue(rotated.account.id, rotated.token), portalCookieOptions());

  recordActivity(req, {
    actorKind: "parent",
    actorId: rotated.account.id,
    actorLabel: rotated.account.email,
    action: "parent.login.google",
    description: "Parent signed in with Google",
    metadata: { linkedPlayerCount: linked.players.length }
  });

  return NextResponse.json({
    message: "Signed in.",
    account: { id: rotated.account.id, email: rotated.account.email, fullName: rotated.account.fullName }
  });
}
