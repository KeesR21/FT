import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isApprovedOnRoster, isPendingRegistration, isWithdrawnPlayer } from "@/lib/player-roster";
import { requireAdmin } from "@/lib/require-admin";

type MoneyAgg = {
  paid: number;
  outstanding: number;
  totalInvoices: number;
};

function initMoneyAgg(): MoneyAgg {
  return { paid: 0, outstanding: 0, totalInvoices: 0 };
}

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const players = await db.listPlayers({ includeWithdrawn: true });
  const payments = await db.listPayments();

  const playersById = new Map(players.map((p) => [p.id, p]));
  const parentsByPlayer = new Map<string, Awaited<ReturnType<typeof db.getParentByPlayerId>>>();
  await Promise.all(
    players.map(async (p) => {
      parentsByPlayer.set(p.id, await db.getParentByPlayerId(p.id));
    })
  );

  const individualFinancial = players.map((player) => {
    const playerPayments = payments.filter((pay) => pay.playerId === player.id);
    const paid = playerPayments.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amount, 0);
    const outstanding = playerPayments
      .filter((p) => p.status !== "paid")
      .reduce((sum, p) => sum + p.amount, 0);
    const parent = parentsByPlayer.get(player.id);
    return {
      playerId: player.id,
      playerName: player.playerName,
      ageGroup: player.ageGroup,
      registrationStatus: player.registrationStatus,
      parentName: parent?.parentName ?? "",
      parentEmail: parent?.email ?? "",
      paid,
      outstanding,
      invoiceCount: playerPayments.length
    };
  });

  const financialByParent = new Map<
    string,
    { parentId: string; parentName: string; parentEmail: string; parentPhone: string; children: Set<string>; paid: number; outstanding: number; totalInvoices: number }
  >();
  for (const player of players) {
    const parent = parentsByPlayer.get(player.id);
    if (!parent) continue;
    const row = financialByParent.get(parent.id) ?? {
      parentId: parent.id,
      parentName: parent.parentName,
      parentEmail: parent.email,
      parentPhone: parent.phoneNumber,
      children: new Set<string>(),
      paid: 0,
      outstanding: 0,
      totalInvoices: 0
    };
    row.children.add(player.playerName);
    const playerPayments = payments.filter((pay) => pay.playerId === player.id);
    for (const pay of playerPayments) {
      row.totalInvoices += 1;
      if (pay.status === "paid") row.paid += pay.amount;
      else row.outstanding += pay.amount;
    }
    financialByParent.set(parent.id, row);
  }

  const financialByGroup = new Map<string, MoneyAgg>();
  for (const payment of payments) {
    const player = playersById.get(payment.playerId);
    if (!player) continue;
    const current = financialByGroup.get(player.ageGroup) ?? initMoneyAgg();
    if (payment.status === "paid") current.paid += payment.amount;
    else current.outstanding += payment.amount;
    current.totalInvoices += 1;
    financialByGroup.set(player.ageGroup, current);
  }

  const registrationAgeBreakdown = new Map<string, number>();
  const registrationByDate = new Map<string, number>();
  for (const player of players) {
    registrationAgeBreakdown.set(player.ageGroup, (registrationAgeBreakdown.get(player.ageGroup) ?? 0) + 1);
    const key = player.createdAt?.slice(0, 10) ?? "unknown";
    registrationByDate.set(key, (registrationByDate.get(key) ?? 0) + 1);
  }

  const overall = payments.reduce(
    (acc, p) => {
      acc.totalInvoices += 1;
      if (p.status === "paid") acc.totalPaid += p.amount;
      else acc.totalOutstanding += p.amount;
      return acc;
    },
    { totalInvoices: 0, totalPaid: 0, totalOutstanding: 0 }
  );

  const activeOnRoster = players.filter(isApprovedOnRoster).length;
  const pendingApplications = players.filter(isPendingRegistration).length;
  const withdrawnArchived = players.filter(isWithdrawnPlayer).length;
  /** Everyone in the database (active + pending + withdrawn). Often higher than “players on my roster” views that hide withdrawn. */
  const totalPlayerRecords = players.length;

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    financial: {
      overall,
      byGroup: Array.from(financialByGroup.entries()).map(([ageGroup, agg]) => ({ ageGroup, ...agg })),
      byPlayer: individualFinancial,
      byParent: Array.from(financialByParent.values())
        .map((row) => ({
          parentId: row.parentId,
          parentName: row.parentName,
          parentEmail: row.parentEmail,
          parentPhone: row.parentPhone,
          childrenCount: row.children.size,
          paid: row.paid,
          outstanding: row.outstanding,
          totalInvoices: row.totalInvoices
        }))
        .sort((a, b) => b.outstanding - a.outstanding)
    },
    registrations: {
      /** @deprecated Prefer rosterBreakdown — this is all DB rows including withdrawn + pending. */
      totalPlayers: totalPlayerRecords,
      rosterBreakdown: {
        activeOnRoster,
        pendingApplications,
        withdrawnArchived,
        totalRecords: totalPlayerRecords
      },
      byAgeGroup: Array.from(registrationAgeBreakdown.entries()).map(([ageGroup, count]) => ({ ageGroup, count })),
      byRegistrationDate: Array.from(registrationByDate.entries()).map(([date, count]) => ({ date, count })),
      parentGuardians: players.map((player) => {
        const parent = parentsByPlayer.get(player.id);
        return {
          playerId: player.id,
          playerName: player.playerName,
          ageGroup: player.ageGroup,
          registrationStatus: player.registrationStatus,
          parentName: parent?.parentName ?? "",
          parentEmail: parent?.email ?? "",
          parentPhone: parent?.phoneNumber ?? "",
          parentAddress: parent?.address ?? ""
        };
      })
    }
  });
}
