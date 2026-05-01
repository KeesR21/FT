import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hasActivePaidMembership } from "@/lib/notifications";
import { revalidateAdminViews } from "@/lib/revalidate-admin";
import { requireAdmin } from "@/lib/require-admin";
import { jsonMessage } from "@/lib/utils";
import { sendEmail } from "@/lib/email";

const postSchema = z.object({
  channel: z.enum(["individual", "group"]),
  playerId: z.string().optional(),
  ageGroup: z.string().optional(),
  subject: z.string().min(2),
  body: z.string().min(4),
  alsoEmail: z.boolean().optional()
});

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  return NextResponse.json({ messages: await db.listMessages() });
}

export async function POST(req: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const body = await req.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(jsonMessage("Invalid message", { issues: parsed.error.flatten() }), { status: 400 });
  }
  const d = parsed.data;
  if (d.channel === "individual" && !d.playerId) {
    return NextResponse.json(jsonMessage("playerId required for individual channel"), { status: 400 });
  }
  if (d.channel === "group" && !d.ageGroup) {
    return NextResponse.json(jsonMessage("ageGroup required for group channel"), { status: 400 });
  }

  const msg = await db.addMessage({
    channel: d.channel,
    playerId: d.playerId,
    ageGroup: d.ageGroup,
    subject: d.subject,
    body: d.body,
    sentBy: "Admin"
  });
  revalidateAdminViews();

  if (parsed.data.alsoEmail) {
    if (d.channel === "individual" && d.playerId) {
      const pl = await db.getPlayer(d.playerId);
      if (!pl || !(await hasActivePaidMembership(pl.id, pl.subscriptionValidUntil))) {
        return NextResponse.json(
          jsonMessage("Player does not have an active paid membership. Email was not sent."),
          { status: 400 }
        );
      }
      const parent = await db.getParentByPlayerId(d.playerId);
      if (parent) await sendEmail(parent.email, d.subject, `<p>${d.body.replace(/\n/g, "<br/>")}</p>`);
    }
    if (d.channel === "group" && d.ageGroup) {
      const pls = await db.listPlayers({ includeWithdrawn: false, group: d.ageGroup, registration: "approved" });
      const targets = (
        await Promise.all(
          pls.map(async (pl) => {
            const eligible = await hasActivePaidMembership(pl.id, pl.subscriptionValidUntil);
            if (!eligible) return null;
            return db.getParentByPlayerId(pl.id);
          })
        )
      ).filter(Boolean) as { email: string }[];
      const seen = new Set<string>();
      for (const t of targets) {
        if (seen.has(t.email)) continue;
        seen.add(t.email);
        await sendEmail(t.email, d.subject, `<p>${d.body.replace(/\n/g, "<br/>")}</p>`);
      }
    }
  }

  return NextResponse.json({ message: msg }, { status: 201 });
}
