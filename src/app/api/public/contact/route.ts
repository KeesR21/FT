import { NextResponse } from "next/server";
import { z } from "zod";
import { sendEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/request-ip";

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(120),
  email: z.string().trim().email("Enter a valid email address."),
  message: z.string().trim().min(10, "Message must be at least 10 characters.").max(3000)
});

const CONTACT_EMAIL = process.env.CONTACT_EMAIL ?? process.env.ADMIN_EMAIL ?? "admin@ftprlions.com";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;"
  );
}

export async function POST(req: Request) {
  // Rate-limit: 5 messages per IP per hour
  const ip = getRequestIp(req);
  const rl = checkRateLimit(`contact:${ip}`, 5, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { message: "Too many messages sent. Please try again later." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Expected JSON body." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid submission." },
      { status: 400 }
    );
  }

  const { name, email, message } = parsed.data;

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;color:#0f172a;max-width:600px;margin:0 auto">
      <h2 style="color:#0b3a82;margin:0 0 16px">New contact message — FTPR Lions Academy</h2>
      <table style="border-collapse:collapse;width:100%;margin-bottom:16px">
        <tr><td style="padding:6px 0;color:#475569;width:80px">From</td><td style="padding:6px 0"><strong>${escapeHtml(name)}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#475569">Email</td><td style="padding:6px 0"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
      </table>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;white-space:pre-wrap;line-height:1.6">
        ${escapeHtml(message)}
      </div>
      <p style="margin:16px 0 0;color:#64748b;font-size:0.85rem">Sent via the FTPR Lions Academy contact form.</p>
    </div>
  `;

  await sendEmail(
    CONTACT_EMAIL,
    `Contact form: ${name}`,
    html
  );

  return NextResponse.json({ message: "Message sent. We'll be in touch during office hours." });
}
