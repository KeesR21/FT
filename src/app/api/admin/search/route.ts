import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";

export async function GET(req: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const q = new URL(req.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ players: [], payments: [], query: q });
  }

  const allPlayers = await db.listPlayers({ includeWithdrawn: true });
  const players: typeof allPlayers = [];
  for (const p of allPlayers) {
    if (p.playerName.toLowerCase().includes(q)) {
      players.push(p);
      continue;
    }
    const par = await db.getParentByPlayerId(p.id);
    if (!par) continue;
    if (
      par.parentName.toLowerCase().includes(q) ||
      par.email.toLowerCase().includes(q) ||
      par.phoneNumber.replace(/\s/g, "").includes(q.replace(/\s/g, ""))
    ) {
      players.push(p);
    }
  }

  const allPayments = await db.listPayments();
  const payments = [];
  for (const pay of allPayments) {
    const pl = await db.getPlayer(pay.playerId);
    const name = pl?.playerName?.toLowerCase() ?? "";
    if (name.includes(q) || pay.paymentFor.toLowerCase().includes(q)) payments.push(pay);
    if (payments.length >= 25) break;
  }

  const playerSummaries = [];
  for (const p of players.slice(0, 40)) {
    playerSummaries.push({
      id: p.id,
      playerName: p.playerName,
      ageGroup: p.ageGroup,
      registrationStatus: p.registrationStatus,
      status: p.status,
      parent: await db.getParentByPlayerId(p.id)
    });
  }

  return NextResponse.json({ players: playerSummaries, payments, query: q });
}
