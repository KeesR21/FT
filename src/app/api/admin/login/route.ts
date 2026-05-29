import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { initializeAdminCredentials, rotateAdminSessionToken, verifyAdminLogin } from "@/lib/admin-credential-store";
import { ADMIN_COOKIE, adminSessionCookieOptions } from "@/lib/auth";
import { recordActivity } from "@/lib/activity-log";
import { hashPassword } from "@/lib/password-hash";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/request-ip";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_PER_IP = 12;

export async function POST(req: Request) {
  const ip = getRequestIp(req);
  const rl = checkRateLimit(`admin-login:${ip}`, LOGIN_MAX_PER_IP, LOGIN_WINDOW_MS);
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
    return NextResponse.json({ message: "Expected JSON body" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Enter a valid email and password." }, { status: 400 });
  }

  const { email, password } = parsed.data;
  const emailLower = email.trim().toLowerCase();

  const ctx = await verifyAdminLogin(email, password);
  if (!ctx) {
    recordActivity(req, {
      actorKind: "admin",
      actorId: emailLower,
      actorLabel: email.trim(),
      action: "admin.login.failure",
      description: "Failed administrator sign-in attempt",
      metadata: { email: emailLower }
    });
    return NextResponse.json({ message: "Invalid email or password" }, { status: 401 });
  }

  let sessionToken: string;

  if (ctx.mode === "legacy_env") {
    const hashed = await hashPassword(password);
    const rec = await initializeAdminCredentials(email, hashed);
    sessionToken = rec.sessionToken;
  } else {
    const rotated = await rotateAdminSessionToken();
    if (!rotated?.sessionToken) {
      return NextResponse.json({ message: "Could not start session" }, { status: 500 });
    }
    sessionToken = rotated.sessionToken;
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, sessionToken, adminSessionCookieOptions());

  recordActivity(req, {
    actorKind: "admin",
    actorId: emailLower,
    actorLabel: email.trim(),
    action: "admin.login.success",
    description: "Administrator signed in",
    metadata: { mode: ctx.mode }
  });

  return NextResponse.json({ message: "Login successful" });
}
