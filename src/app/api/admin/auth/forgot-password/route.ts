import { NextResponse } from "next/server";
import { z } from "zod";
import { getConfiguredAdminEmailLower } from "@/lib/admin-credential-store";
import { getAppBaseUrl } from "@/lib/app-base-url";
import { sendEmail } from "@/lib/email";
import { recordActivity } from "@/lib/activity-log";
import { issuePasswordResetToken } from "@/lib/password-reset-store";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/request-ip";
import { jsonMessage } from "@/lib/utils";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address.")
});

const GENERIC = "If an account matches this email, a reset link was sent.";

const FORGOT_WINDOW_MS = 60 * 60 * 1000;
const FORGOT_MAX_PER_IP = 8;

export async function POST(req: Request) {
  const ip = getRequestIp(req);
  const rl = checkRateLimit(`admin-forgot:${ip}`, FORGOT_MAX_PER_IP, FORGOT_WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      { message: "Too many reset requests. Please try again later.", retryAfterSec: rl.retryAfterSec },
      { status: 429 }
    );
  }

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

  const emailLower = parsed.data.email.toLowerCase();
  const configured = getConfiguredAdminEmailLower();

  if (emailLower !== configured) {
    recordActivity(req, {
      actorKind: "system",
      actorId: "system",
      actorLabel: "System",
      action: "admin.password.reset.request",
      description: "Admin password reset requested (no matching configured account)",
      metadata: { matched: false }
    });
    return NextResponse.json({ message: GENERIC });
  }

  try {
    const { rawToken } = await issuePasswordResetToken("admin", configured);
    const url = `${getAppBaseUrl()}/admin/reset-password?t=${encodeURIComponent(rawToken)}`;
    await sendEmail(
      emailLower,
      "Reset your academy admin password",
      `<p>We received a request to reset your FTPR Lions Academy administrator password.</p>
       <p><a href="${url}">Set a new password</a></p>
       <p>This link expires in about 45 minutes. If you did not ask for this, you can ignore this email.</p>`
    );
  } catch {
    /* still generic */
  }

  recordActivity(req, {
    actorKind: "admin",
    actorId: configured,
    actorLabel: configured,
    action: "admin.password.reset.request",
    description: "Administrator password reset email issued"
  });

  return NextResponse.json({ message: GENERIC });
}
