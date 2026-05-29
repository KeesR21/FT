import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { recordActivity } from "@/lib/activity-log";
import { getAccountByEmail, rotateSessionToken } from "@/lib/parent-account-store";
import { verifyPassword } from "@/lib/password-hash";
import { NO_RECORD_ERROR } from "@/lib/portal-errors";
import { findLinkedPlayersByEmail } from "@/lib/portal-linked-players";
import { buildPortalCookieValue, PORTAL_COOKIE, portalCookieOptions } from "@/lib/portal-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/request-ip";
import { jsonMessage } from "@/lib/utils";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  password: z.string().min(1, "Password is required.")
});

const INVALID_MSG = "Invalid email or password.";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_PER_IP = 24;

export async function POST(req: Request) {
  const ip = getRequestIp(req);
  const rl = checkRateLimit(`portal-login:${ip}`, LOGIN_MAX_PER_IP, LOGIN_WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      { message: "Too many sign-in attempts. Please try again later.", retryAfterSec: rl.retryAfterSec },
      { status: 429 }
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

  const { email, password } = parsed.data;
  const account = await getAccountByEmail(email);
  if (!account || !account.passwordHash) {
    recordActivity(req, {
      actorKind: "parent",
      actorId: email,
      actorLabel: email,
      action: "parent.login.failure",
      description: "Failed parent portal sign-in (unknown account or no password)",
      metadata: { email }
    });
    return NextResponse.json({ message: INVALID_MSG }, { status: 401 });
  }

  const valid = await verifyPassword(password, account.passwordHash);
  if (!valid) {
    recordActivity(req, {
      actorKind: "parent",
      actorId: account.id,
      actorLabel: account.email,
      action: "parent.login.failure",
      description: "Failed parent portal sign-in (bad password)",
      metadata: { email: account.emailLower ?? email }
    });
    return NextResponse.json({ message: INVALID_MSG }, { status: 401 });
  }

  // Make sure the academy still has a parent record for this email — guards
  // against orphaned portal accounts after admin-side cleanup.
  const linked = await findLinkedPlayersByEmail(email);
  if (linked.parents.length === 0) {
    recordActivity(req, {
      actorKind: "parent",
      actorId: account.id,
      actorLabel: account.email,
      action: "parent.login.failure",
      description: "Parent sign-in blocked: no linked academy records for this email",
      metadata: { reason: "no_linked_parent" }
    });
    return NextResponse.json({ message: NO_RECORD_ERROR }, { status: 403 });
  }

  const rotated = await rotateSessionToken(account.id);
  if (!rotated) {
    recordActivity(req, {
      actorKind: "parent",
      actorId: account.id,
      actorLabel: account.email,
      action: "parent.login.failure",
      description: "Parent sign-in failed: could not start session",
      metadata: { reason: "session_rotate_failed" }
    });
    return NextResponse.json({ message: "Could not start a session. Please retry." }, { status: 500 });
  }

  const store = await cookies();
  store.set(PORTAL_COOKIE, buildPortalCookieValue(rotated.account.id, rotated.token), portalCookieOptions());

  recordActivity(req, {
    actorKind: "parent",
    actorId: rotated.account.id,
    actorLabel: rotated.account.email,
    action: "parent.login.success",
    description: "Parent signed in with email and password",
    metadata: { linkedPlayerCount: linked.players.length }
  });

  return NextResponse.json({
    message: "Signed in.",
    account: {
      id: rotated.account.id,
      email: rotated.account.email,
      fullName: rotated.account.fullName
    },
    linkedPlayerCount: linked.players.length
  });
}
