import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccountByEmail, updateAccount } from "@/lib/parent-account-store";
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

  const record = await consumePasswordResetToken(token, "parent");
  if (!record) {
    return NextResponse.json(jsonMessage("Reset link is invalid or has expired."), { status: 400 });
  }

  const acc = await getAccountByEmail(record.identifier);
  if (!acc) {
    return NextResponse.json(jsonMessage("Reset link is invalid or has expired."), { status: 400 });
  }

  await updateAccount(acc.id, {
    passwordHash: await hashPassword(newPassword),
    sessionToken: undefined
  });

  recordActivity(req, {
    actorKind: "parent",
    actorId: acc.id,
    actorLabel: acc.email,
    action: "parent.password.reset",
    description: "Parent password reset via email link"
  });

  return NextResponse.json({
    message: "Password saved. Sign in with your new password.",
    redirected: true
  });
}
