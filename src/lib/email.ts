import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendEmail(to: string, subject: string, html: string) {
  if (!resend || !process.env.EMAIL_FROM) {
    console.log("Email skipped (missing provider config):", { to, subject });
    return { skipped: true as const };
  }
  try {
    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html
    });
    return { sent: true as const, result };
  } catch (e) {
    console.error("sendEmail failed:", e);
    return {
      failed: true as const,
      error: e instanceof Error ? e.message : "Email send failed"
    };
  }
}
