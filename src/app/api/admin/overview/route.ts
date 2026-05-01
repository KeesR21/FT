import { NextResponse } from "next/server";
import { endOfWeek, isSameDay, parseISO, startOfWeek } from "date-fns";
import { db } from "@/lib/db";
import { isApprovedOnRoster, isPendingRegistration, isWithdrawnPlayer } from "@/lib/player-roster";
import { requireAdmin } from "@/lib/require-admin";
import { subscriptionStatusFromDate } from "@/lib/subscription-ui";

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const players = await db.listPlayers({ includeWithdrawn: true });
  const payments = await db.listPayments();
  const pending = players.filter(isPendingRegistration).length;
  const active = players.filter(isApprovedOnRoster).length;
  const withdrawn = players.filter(isWithdrawnPlayer).length;
  let revenue = 0;
  let outstanding = 0;
  let payPaid = 0;
  let payPending = 0;
  let payNotPaid = 0;
  let payOverdue = 0;
  for (const p of payments) {
    const { status, amount } = p;
    if (status === "paid") {
      payPaid++;
      revenue += amount;
      continue;
    }
    if (status === "pending") {
      payPending++;
      outstanding += amount;
      continue;
    }
    if (status === "not_paid" || status === "expiring_soon") {
      payNotPaid++;
      outstanding += amount;
      continue;
    }
    if (status === "overdue") {
      payOverdue++;
      outstanding += amount;
    }
  }

  const approved = players.filter((p) => p.registrationStatus === "approved");
  let subActive = 0;
  let subExpiring = 0;
  let subExpired = 0;
  let subEnded = 0;
  for (const p of approved) {
    const u = subscriptionStatusFromDate(p.subscriptionValidUntil);
    if (u === "active") subActive++;
    else if (u === "expiring_soon") subExpiring++;
    else if (u === "expired") subExpired++;
    else subEnded++;
  }
  const now = new Date();
  const membershipsDeadlineToday = approved.filter((p) => {
    if (!p.subscriptionValidUntil) return false;
    const d = parseISO(p.subscriptionValidUntil);
    return Number.isFinite(d.getTime()) && isSameDay(d, now);
  }).length;
  const newJoinedToday = approved.filter((p) => {
    if (!p.createdAt) return false;
    const d = parseISO(p.createdAt);
    return Number.isFinite(d.getTime()) && isSameDay(d, now);
  }).length;
  const applicationsToday = players.filter((p) => {
    if (!p.createdAt) return false;
    const d = parseISO(p.createdAt);
    return Number.isFinite(d.getTime()) && isSameDay(d, now);
  }).length;

  const sessions = await db.listSessions();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const sessionsThisWeek = sessions.filter((s) => {
    const st = parseISO(s.startsAt);
    return Number.isFinite(st.getTime()) && st >= weekStart && st <= weekEnd;
  }).length;

  return NextResponse.json({
    counts: { pending, active, withdrawn, totalPlayers: players.length },
    payments: {
      paid: payPaid,
      pending: payPending,
      notPaid: payNotPaid,
      overdue: payOverdue,
      revenue,
      outstandingApprox: outstanding
    },
    subscriptions: {
      active: subActive,
      expiringSoon: subExpiring,
      expired: subExpired,
      ended: subEnded
    },
    daily: {
      membershipsDeadlineToday,
      newJoinedToday,
      applicationsToday
    },
    sessionsThisWeek
  });
}
