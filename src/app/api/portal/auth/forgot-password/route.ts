import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppBaseUrl } from "@/lib/app-base-url";
import { sendEmail } from "@/lib/email";
import { getAccountByEmail } from "@/lib/parent-account-store";
import { recordActivity } from "@/lib/activity-log";
import { issuePasswordResetToken } from "@/lib/password-reset-store";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/request-ip";
import { jsonMessage } from "@/lib/utils";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address.")
});

const GENERIC =
  "If an account matches this email, you'll receive reset instructions shortly.";

const FORGOT_WINDOW_MS = 60 * 60 * 1000;
const FORGOT_MAX_PER_IP = 12;

export async function POST(req: Request) {
  const ip = getRequestIp(req);
  const rl = checkRateLimit(`parent-forgot:${ip}`, FORGOT_MAX_PER_IP, FORGOT_WINDOW_MS);
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

  try {
    const account = await getAccountByEmail(emailLower);
    if (account?.emailLower) {
      const { rawToken } = await issuePasswordResetToken("parent", account.emailLower);
      const url = `${getAppBaseUrl()}/portal/reset-password?t=${encodeURIComponent(rawToken)}`;
      await sendEmail(
        account.email,
        "Reset your parent portal password",
        `<p>We received a request to reset your FTPR Lions parent portal password.</p>
         <p><a href="${url}">Choose a new password</a></p>
         <p>This link expires in about 45 minutes.</p>`
      );
      recordActivity(req, {
        actorKind: "parent",
        actorId: account.id,
        actorLabel: account.email,
        action: "parent.password.reset.request",
        description: "Parent portal password reset email issued"
      });
    }
  } catch {
    /* swallow */
  }

  return NextResponse.json({ message: GENERIC });
}
