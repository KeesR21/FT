import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminCredentials, setAdminPasswordHashClearingSession, acceptsLegacyPlaintext } from "@/lib/admin-credential-store";
import { ADMIN_COOKIE, adminSessionCookieOptions } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password-hash";
import { validatePasswordStrength } from "@/lib/password-strength";
import { getAuthenticatedAdminActor } from "@/lib/admin-actor";
import { recordActivity } from "@/lib/activity-log";
import { requireAdmin } from "@/lib/require-admin";
import { jsonMessage } from "@/lib/utils";

const schema = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newPassword: z.string().min(8, "New password must be at least 8 characters."),
  confirmPassword: z.string().min(1, "Confirm your new password.")
});

export async function POST(req: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const cred = await getAdminCredentials();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(jsonMessage("Expected JSON body"), { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid request.";
    return NextResponse.json(jsonMessage(msg, { issues: parsed.error.flatten() }), { status: 400 });
  }
  const { currentPassword, newPassword, confirmPassword } = parsed.data;

  if (newPassword !== confirmPassword) {
    return NextResponse.json(jsonMessage("New password and confirmation do not match."), { status: 400 });
  }

  const strong = validatePasswordStrength(newPassword);
  if (!strong.ok) {
    return NextResponse.json(jsonMessage(strong.reason), { status: 400 });
  }

  const currentPwdOk =
    cred !== null ? await verifyPassword(currentPassword, cred.passwordHash) : acceptsLegacyPlaintext(currentPassword);

  if (!currentPwdOk) {
    return NextResponse.json(jsonMessage("Current password is incorrect."), { status: 400 });
  }

  const hashed = await hashPassword(newPassword);
  const actor = await getAuthenticatedAdminActor();
  recordActivity(req, {
    actorKind: "admin",
    actorId: actor.id,
    actorLabel: actor.label,
    action: "admin.password.change",
    description: "Administrator changed password (session cleared)"
  });
  await setAdminPasswordHashClearingSession(hashed);

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, "", adminSessionCookieOptions({ clear: true }));

  return NextResponse.json({ message: "Password updated successfully. Please sign in again." });
}
