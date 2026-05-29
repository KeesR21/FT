import { NextResponse } from "next/server";
import { z } from "zod";
import { getConfiguredAdminEmailLower, setAdminPasswordHashClearingSession } from "@/lib/admin-credential-store";
import { hashPassword } from "@/lib/password-hash";
import { validatePasswordStrength } from "@/lib/password-strength";
import { recordActivity } from "@/lib/activity-log";
import { consumePasswordResetToken } from "@/lib/password-reset-store";
import { jsonMessage } from "@/lib/utils";

const schema = z.object({
  token: z.string().min(16, "Invalid or expired reset link."),
  newPassword: z.string().min(8, "Password must be at least 8 characters."),
  confirmPassword: z.string().min(1, "Confirm your new password.")
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(jsonMessage("Expected JSON body"), { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(jsonMessage(parsed.error.issues[0]?.message ?? "Invalid request."), { status: 400 });
  }

  const { token, newPassword, confirmPassword } = parsed.data;
  if (newPassword !== confirmPassword) {
    return NextResponse.json(jsonMessage("Password and confirmation do not match."), { status: 400 });
  }

  const strong = validatePasswordStrength(newPassword);
  if (!strong.ok) {
    return NextResponse.json(jsonMessage(strong.reason), { status: 400 });
  }

  const record = await consumePasswordResetToken(token, "admin");
  if (!record) {
    return NextResponse.json(jsonMessage("Reset link is invalid or has expired."), { status: 400 });
  }

  const expected = getConfiguredAdminEmailLower();
  if (record.identifier !== expected) {
    return NextResponse.json(jsonMessage("Reset link is invalid or has expired."), { status: 400 });
  }

  try {
    const hashed = await hashPassword(newPassword);
    await setAdminPasswordHashClearingSession(hashed);
  } catch {
    return NextResponse.json(jsonMessage("Could not update password."), { status: 500 });
  }

  recordActivity(req, {
    actorKind: "admin",
    actorId: record.identifier,
    actorLabel: record.identifier,
    action: "admin.password.reset",
    description: "Administrator password reset via email link (session cleared)"
  });

  return NextResponse.json({
    message: "Password saved. Sign in using your new administrator password.",
    redirected: true
  });
}
