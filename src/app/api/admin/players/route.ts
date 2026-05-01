import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { AGE_GROUPS, isAgeGroup } from "@/lib/age-groups";
import { resolveLedgerPaymentFor } from "@/lib/payment-guards";
import { requireAdmin } from "@/lib/require-admin";
import { revalidateAdminViews } from "@/lib/revalidate-admin";
import { subscriptionStatusFromDate } from "@/lib/subscription-ui";
import type { RegistrationStatus } from "@/lib/types";

export async function GET(req: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const url = new URL(req.url);
  const includeWithdrawn = url.searchParams.get("withdrawn") === "1";
  const group = url.searchParams.get("group") ?? undefined;
  const reg = (url.searchParams.get("registration") as RegistrationStatus | "all" | null) ?? "all";
  const q = url.searchParams.get("q")?.trim().toLowerCase();

  let players = await db.listPlayers({
    includeWithdrawn,
    group,
    registration: reg === "all" ? "all" : reg
  });

  if (q) {
    const filtered = [];
    for (const p of players) {
      if (p.playerName.toLowerCase().includes(q)) {
        filtered.push(p);
        continue;
      }
      const par = await db.getParentByPlayerId(p.id);
      if (!par) continue;
      if (
        par.parentName.toLowerCase().includes(q) ||
        par.email.toLowerCase().includes(q) ||
        par.phoneNumber.replace(/\s/g, "").includes(q.replace(/\s/g, ""))
      ) {
        filtered.push(p);
      }
    }
    players = filtered;
  }

  const enriched = await Promise.all(
    players.map(async (p) => {
      const parent = await db.getParentByPlayerId(p.id);
      const payments = (await db.listPaymentsForPlayer(p.id)).map((pay) => ({
        ...pay,
        paymentFor: resolveLedgerPaymentFor(pay.paymentFor, pay.dueDate)
      }));
      return {
        ...p,
        parent,
        payments,
        subscriptionUi: subscriptionStatusFromDate(p.subscriptionValidUntil)
      };
    })
  );

  return NextResponse.json({ players: enriched });
}

const rosterImportSchema = z.object({
  names: z.array(z.string().min(1)).min(1),
  ageGroup: z.string().optional()
});

export async function POST(req: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Expected JSON body" }, { status: 400 });
  }
  const parsed = rosterImportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid import payload", issues: parsed.error.flatten() }, { status: 400 });
  }
  const names = parsed.data.names
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((v, i, arr) => arr.findIndex((n) => n.toLowerCase() === v.toLowerCase()) === i);
  if (names.length === 0) {
    return NextResponse.json({ message: "No player names found in import." }, { status: 400 });
  }
  const ageGroup = parsed.data.ageGroup && isAgeGroup(parsed.data.ageGroup) ? parsed.data.ageGroup : AGE_GROUPS[2];
  const result = await db.createRosterPlayersFromNames({
    rows: names.map((playerName) => ({ playerName, ageGroup }))
  });
  revalidateAdminViews();
  return NextResponse.json({
    createdCount: result.created.length,
    skippedCount: result.skippedNames.length,
    skippedNames: result.skippedNames
  });
}
