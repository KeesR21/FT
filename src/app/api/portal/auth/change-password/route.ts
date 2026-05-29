import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { updateAccount } from "@/lib/parent-account-store";
import { hashPassword, verifyPassword } from "@/lib/password-hash";
import { validatePasswordStrength } from "@/lib/password-strength";
import { PORTAL_COOKIE, portalCookieOptions } from "@/lib/portal-auth";
import { recordActivity } from "@/lib/activity-log";
import { requirePortalAccount } from "@/lib/require-portal";
import { jsonMessage } from "@/lib/utils";

const schema = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newPassword: z.string().min(8, "New password must be at least 8 characters."),
  confirmPassword: z.string().min(1, "Confirm your new password.")
});

export async function POST(req: Request) {
  const gate = await requirePortalAccount();
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(jsonMessage("Expected JSON body"), { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid request.";
    return NextResponse.json(jsonMessage(msg), { status: 400 });
  }

  const { currentPassword, newPassword, confirmPassword } = parsed.data;

  if (newPassword !== confirmPassword) {
    return NextResponse.json(jsonMessage("New password and confirmation do not match."), { status: 400 });
  }

  const strong = validatePasswordStrength(newPassword);
  if (!strong.ok) {
    return NextResponse.json(jsonMessage(strong.reason), { status: 400 });
  }

  const { account } = gate;
  if (!account.passwordHash) {
    return NextResponse.json(
      jsonMessage("No password on file for this account. Use “Forgot password” to choose one via email."),
      { status: 400 }
    );
  }

  const currentOk = await verifyPassword(currentPassword, account.passwordHash);
  if (!currentOk) {
    return NextResponse.json(jsonMessage("Current password is incorrect."), { status: 400 });
  }

  await updateAccount(account.id, {
    passwordHash: await hashPassword(newPassword),
    sessionToken: undefined
  });

  recordActivity(req, {
    actorKind: "parent",
    actorId: account.id,
    actorLabel: account.email,
    action: "parent.password.change",
    description: "Parent changed portal password (session cleared)"
  });

  const store = await cookies();
  store.set(PORTAL_COOKIE, "", portalCookieOptions({ clear: true }));

  return NextResponse.json({ message: "Password updated successfully. Please sign in again." });
}
