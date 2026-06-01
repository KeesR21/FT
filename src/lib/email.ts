import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  opts?: { replyTo?: string }
) {
  if (!resend || !process.env.EMAIL_FROM) {
    console.warn("[email] Skipped — set RESEND_API_KEY and EMAIL_FROM in .env.local:", { to, subject });
    return { skipped: true as const };
  }
  try {
    const result = await resend.emails.send({
      from: `FTPR Lions Academy <${process.env.EMAIL_FROM}>`,
      to,
      replyTo: opts?.replyTo,
      subject,
      html
    });
    return { sent: true as const, result };
  } catch (e) {
    console.error("[email] sendEmail failed:", e);
    return {
      failed: true as const,
      error: e instanceof Error ? e.message : "Email send failed"
    };
  }
}
