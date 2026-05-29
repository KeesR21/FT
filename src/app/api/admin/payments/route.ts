import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  daysSinceSubscriptionEnded,
  isPlayerInDanger,
  projectUpcomingMembershipWindow
} from "@/lib/membership-billing";
import { sendInvoiceIssuedEmail } from "@/lib/notifications";
import {
  canCreateNewMonthlyInvoice,
  isDuplicateOpenInvoice,
  LEDGER_REGISTRATION_FEE_LABEL,
  monthKey,
  monthlyFeePaymentFor,
  resolveLedgerPaymentFor
} from "@/lib/payment-guards";
import { revalidateAdminViews } from "@/lib/revalidate-admin";
import { requireAdmin } from "@/lib/require-admin";
import { paymentCategoryKey } from "@/lib/finance-format";
import { subscriptionStatusFromDate } from "@/lib/subscription-ui";
import { paymentStatusLabel } from "@/lib/utils";

const createSchema = z.object({
  playerId: z.string().min(1),
  amount: z.coerce.number().positive(),
  currency: z.string().default("RWF"),
  /** Ledger supports only registration vs monthly; description is set automatically from this and the due date. */
  lineKind: z.enum(["registration", "monthly"]),
  /** ISO or YYYY-MM-DD; defaults to now when omitted (duplicate check uses that month). */
  dueDate: z.string().trim().optional(),
  paymentMethod: z.enum(["cash", "mobile_money", "bank_transfer", "card", "other"]).optional(),
  mobileMoneyRef: z.string().optional(),
  paymentNotes: z.string().optional(),
  sendInvoice: z.boolean().optional().default(true)
});

/** Ledger must never be served from a shared cache after a mutation. */
const ADMIN_LEDGER_NO_STORE = {
  headers: {
    "Cache-Control": "private, no-store, max-age=0, must-revalidate",
    Pragma: "no-cache"
  }
};

export async function GET(req: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status");
  const monthFilter = url.searchParams.get("month"); // YYYY-MM
  const groupFilter = url.searchParams.get("group");
  const ageFilter = url.searchParams.get("ageGroup");
  const parentIdFilter = url.searchParams.get("parentId");
  const parentEmailFilter = url.searchParams.get("parentEmail")?.trim().toLowerCase();
  const playerIdFilter = url.searchParams.get("playerId")?.trim();
  const q = url.searchParams.get("q")?.trim().toLowerCase();
  const dateFrom = url.searchParams.get("dateFrom")?.trim();
  const dateTo = url.searchParams.get("dateTo")?.trim();
  const typeFilter = url.searchParams.get("type") as "registration" | "membership" | "other" | null;
  const subRaw = url.searchParams.get("subStatus");
  const subStatusFilter =
    subRaw === "active" || subRaw === "expiring_soon" || subRaw === "expired" || subRaw === "ended"
      ? subRaw
      : null;
  const sortBy = (url.searchParams.get("sortBy") ?? "dueDate").toLowerCase();
  const sortDir = url.searchParams.get("sortDir") === "asc" ? 1 : -1;
  const metricsOnly = url.searchParams.get("metricsOnly") === "1";
  const pageRaw = url.searchParams.get("page");
  const pageSizeRaw = url.searchParams.get("pageSize");
  const page = Math.max(1, Number.parseInt(pageRaw || "1", 10) || 1);
  const pageSize =
    pageSizeRaw === null || pageSizeRaw === ""
      ? 0
      : Math.min(100, Math.max(1, Number.parseInt(pageSizeRaw, 10) || 25));

  const payments = await db.listPayments();
  const enrichedRaw = await Promise.all(
    payments.map(async (p) => ({
      ...p,
      player: await db.getPlayer(p.playerId)
    }))
  );
  const enriched = await Promise.all(
    enrichedRaw.map(async (p) => {
      const { player, paymentFor: rawPaymentFor, ...paymentRest } = p;
      const parent = player ? await db.getParentByPlayerId(player.id) : null;
      const uiStatus =
        paymentRest.status === "not_paid" || paymentRest.status === "expiring_soon" ? "unpaid" : paymentRest.status;
      const paymentFor = resolveLedgerPaymentFor(rawPaymentFor, paymentRest.dueDate);
      const category = paymentCategoryKey(paymentFor);
      const isMonthly = category === "membership";
      const projectedWindow =
        isMonthly && player && paymentRest.status !== "paid"
          ? projectUpcomingMembershipWindow(player)
          : null;
      const danger = player ? isPlayerInDanger(player) : false;
      const overdueDays = player ? daysSinceSubscriptionEnded(player.subscriptionValidUntil) : 0;
      return {
        ...paymentRest,
        paymentFor,
        uiStatus,
        uiStatusLabel: paymentStatusLabel(uiStatus),
        playerName: player?.playerName ?? "—",
        ageGroup: player?.ageGroup ?? "—",
        parentId: parent?.id ?? "",
        parentName: parent?.parentName ?? "—",
        parentEmail: parent?.email ?? "",
        paymentCategory: category,
        subscriptionValidUntil: player?.subscriptionValidUntil ?? null,
        subscriptionUiStatus: subscriptionStatusFromDate(player?.subscriptionValidUntil),
        projectedSubscriptionStartsAt: projectedWindow?.startsAt ?? null,
        projectedSubscriptionEndsAt: projectedWindow?.endsAt ?? null,
        playerDanger: danger,
        playerOverdueDays: overdueDays
      };
    })
  );

  const filtered = enriched.filter((row) => {
    if (statusFilter && row.uiStatus !== statusFilter) return false;
    if (playerIdFilter && row.playerId !== playerIdFilter) return false;
    if (monthFilter && monthKey(row.dueDate) !== monthFilter) return false;
    if (groupFilter && row.ageGroup !== groupFilter) return false;
    if (ageFilter && row.ageGroup !== ageFilter) return false;
    if (parentIdFilter && row.parentId !== parentIdFilter) return false;
    if (parentEmailFilter && row.parentEmail.toLowerCase() !== parentEmailFilter) return false;
    if (typeFilter && row.paymentCategory !== typeFilter) return false;
    if (subStatusFilter && row.subscriptionUiStatus !== subStatusFilter) return false;
    const dueDay = row.dueDate.slice(0, 10);
    if (dateFrom && dueDay < dateFrom) return false;
    if (dateTo && dueDay > dateTo) return false;
    if (q) {
      const sub = row.subscriptionValidUntil ? row.subscriptionValidUntil.slice(0, 10) : "";
      const hay = `${row.playerName} ${row.parentName} ${row.parentEmail} ${row.paymentFor} ${sub}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const expectedRevenue = filtered.reduce((s, p) => s + p.amount, 0);
  const collectedRevenue = filtered.filter((p) => p.uiStatus === "paid").reduce((s, p) => s + p.amount, 0);
  const completionRate = expectedRevenue > 0 ? Math.round((collectedRevenue / expectedRevenue) * 100) : 0;
  const statusCounts = {
    paid: filtered.filter((p) => p.uiStatus === "paid").length,
    pending: filtered.filter((p) => p.uiStatus === "pending").length,
    unpaid: filtered.filter((p) => p.uiStatus === "unpaid").length,
    overdue: filtered.filter((p) => p.uiStatus === "overdue").length
  };

  const monthlyMap = new Map<string, { collected: number; expected: number; paid: number; total: number }>();
  for (const p of filtered) {
    const key = monthKey(p.dueDate);
    const cur = monthlyMap.get(key) ?? { collected: 0, expected: 0, paid: 0, total: 0 };
    cur.expected += p.amount;
    cur.total += 1;
    if (p.uiStatus === "paid") {
      cur.collected += p.amount;
      cur.paid += 1;
    }
    monthlyMap.set(key, cur);
  }
  const monthly = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, m]) => ({
      month,
      collected: m.collected,
      expected: m.expected,
      completionRate: m.total > 0 ? Math.round((m.paid / m.total) * 100) : 0
    }));

  const parentSummaryMap = new Map<
    string,
    {
      parentId: string;
      parentName: string;
      parentEmail: string;
      players: Set<string>;
      expected: number;
      collected: number;
      unpaid: number;
      pending: number;
      overdue: number;
    }
  >();
  for (const row of filtered) {
    if (!row.parentId) continue;
    const current = parentSummaryMap.get(row.parentId) ?? {
      parentId: row.parentId,
      parentName: row.parentName,
      parentEmail: row.parentEmail,
      players: new Set<string>(),
      expected: 0,
      collected: 0,
      unpaid: 0,
      pending: 0,
      overdue: 0
    };
    current.players.add(row.playerName);
    current.expected += row.amount;
    if (row.uiStatus === "paid") current.collected += row.amount;
    if (row.uiStatus === "unpaid") current.unpaid += row.amount;
    if (row.uiStatus === "pending") current.pending += row.amount;
    if (row.uiStatus === "overdue") current.overdue += row.amount;
    parentSummaryMap.set(row.parentId, current);
  }
  const byParent = Array.from(parentSummaryMap.values())
    .map((row) => ({
      parentId: row.parentId,
      parentName: row.parentName,
      parentEmail: row.parentEmail,
      childrenCount: row.players.size,
      expected: row.expected,
      collected: row.collected,
      outstanding: row.expected - row.collected,
      statusBuckets: {
        unpaid: row.unpaid,
        pending: row.pending,
        overdue: row.overdue
      }
    }))
    .sort((a, b) => b.outstanding - a.outstanding);

  const outstandingAmount = filtered
    .filter((p) => p.uiStatus !== "paid")
    .reduce((s, p) => s + p.amount, 0);
  const overdueAmount = filtered
    .filter((p) => p.uiStatus === "overdue")
    .reduce((s, p) => s + p.amount, 0);

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case "amount":
        cmp = a.amount - b.amount;
        break;
      case "player":
      case "playername":
        cmp = a.playerName.localeCompare(b.playerName);
        break;
      case "for":
      case "paymentfor":
        cmp = a.paymentFor.localeCompare(b.paymentFor);
        break;
      case "status":
        cmp = a.uiStatus.localeCompare(b.uiStatus);
        break;
      case "paidat":
        cmp = (a.paidAt ?? "").localeCompare(b.paidAt ?? "");
        break;
      default:
        cmp = a.dueDate.localeCompare(b.dueDate);
    }
    return cmp * sortDir;
  });

  const monthlyLast6 = monthly.slice(-6);
  const recentTransactions = sorted.slice(0, 12);

  if (metricsOnly) {
    return NextResponse.json({
      metrics: {
        collectedRevenue,
        expectedRevenue,
        completionRate,
        statusCounts,
        outstandingAmount,
        overdueAmount,
        /** No expense ledger in DB — placeholder for future integration. */
        expensesRecorded: 0,
        netCashPosition: collectedRevenue
      },
      monthly: monthlyLast6,
      recentTransactions,
      alerts: {
        overdueCount: statusCounts.overdue,
        overdueAmount,
        unpaidCount: statusCounts.unpaid,
        pendingReviewCount: statusCounts.pending
      }
    }, ADMIN_LEDGER_NO_STORE);
  }

  const total = sorted.length;
  const paymentsOut = pageSize > 0 ? sorted.slice((page - 1) * pageSize, page * pageSize) : sorted;
  const pagination =
    pageSize > 0
      ? {
          page,
          pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize))
        }
      : undefined;

  return NextResponse.json({
    payments: paymentsOut,
    pagination,
    metrics: {
      collectedRevenue,
      expectedRevenue,
      completionRate,
      statusCounts,
      outstandingAmount,
      overdueAmount,
      expensesRecorded: 0,
      netCashPosition: collectedRevenue
    },
    monthly,
    byParent
  }, ADMIN_LEDGER_NO_STORE);
}

function resolveInvoiceDueDate(raw?: string | null): string {
  const fallback = new Date().toISOString();
  if (!raw?.trim()) return fallback;
  const d = new Date(raw.trim());
  return Number.isNaN(d.getTime()) ? fallback : d.toISOString();
}

export async function POST(req: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payment payload", issues: parsed.error.flatten() }, { status: 400 });
  }
  const effectiveDueDate = resolveInvoiceDueDate(parsed.data.dueDate);
  const ledgerPaymentFor =
    parsed.data.lineKind === "registration"
      ? LEDGER_REGISTRATION_FEE_LABEL
      : monthlyFeePaymentFor(effectiveDueDate);
  const player = await db.getPlayer(parsed.data.playerId);
  if (!player) {
    return NextResponse.json({ message: "Player not found." }, { status: 404 });
  }
  const existing = await db.listPaymentsForPlayer(parsed.data.playerId);
  const who = player.playerName;

  if (parsed.data.lineKind === "monthly") {
    const guard = canCreateNewMonthlyInvoice({
      player,
      payments: existing,
      dueDate: effectiveDueDate
    });
    if (!guard.ok) {
      const existingRow = "existing" in guard ? guard.existing : undefined;
      const messageMap: Record<typeof guard.reason, string> = {
        open_monthly_invoice_exists: `${who} already has an open monthly invoice. Resolve that one (mark paid or void) before creating another. Only one open monthly invoice is allowed per player at a time.`,
        active_subscription_not_renewable_yet: `${who} still has an active monthly subscription. A renewal invoice can only be created when the membership is in its last 3 days or has expired.`,
        duplicate_for_month: `${who} already has an open invoice for ${monthKey(effectiveDueDate)}. Either resolve it or pick a different month.`
      };
      return NextResponse.json(
        {
          message: messageMap[guard.reason],
          code: "MONTHLY_INVOICE_BLOCKED",
          reason: guard.reason,
          existingPayment: existingRow
            ? {
                id: existingRow.id,
                status: existingRow.status,
                dueDate: existingRow.dueDate,
                amount: existingRow.amount,
                currency: existingRow.currency,
                paymentFor: resolveLedgerPaymentFor(existingRow.paymentFor, existingRow.dueDate)
              }
            : undefined
        },
        { status: 409 }
      );
    }
  } else {
    const duplicate = isDuplicateOpenInvoice(existing, {
      paymentFor: ledgerPaymentFor,
      dueDate: effectiveDueDate
    });
    if (duplicate) {
      const month = monthKey(effectiveDueDate);
      return NextResponse.json(
        {
          message: `${who} already has an open invoice for “${resolveLedgerPaymentFor(duplicate.paymentFor, duplicate.dueDate)}” in ${month} (status: ${duplicate.status}). Resolve that row first.`,
          code: "DUPLICATE_OPEN_INVOICE",
          existingPayment: {
            id: duplicate.id,
            status: duplicate.status,
            dueDate: duplicate.dueDate,
            amount: duplicate.amount,
            currency: duplicate.currency,
            paymentFor: resolveLedgerPaymentFor(duplicate.paymentFor, duplicate.dueDate)
          }
        },
        { status: 409 }
      );
    }
  }

  const payment = await db.createPayment({
    playerId: parsed.data.playerId,
    amount: parsed.data.amount,
    currency: parsed.data.currency,
    paymentFor: ledgerPaymentFor,
    dueDate: effectiveDueDate,
    paymentMethod: parsed.data.paymentMethod,
    mobileMoneyRef: parsed.data.mobileMoneyRef,
    paymentNotes: parsed.data.paymentNotes,
    invoiceSentAt: new Date().toISOString()
  });
  const parent = await db.getParentByPlayerId(player.id);
  if (parent?.email) {
    await sendInvoiceIssuedEmail({
      email: parent.email,
      parentName: parent.parentName,
      playerName: player.playerName,
      group: player.ageGroup,
      amount: payment.amount,
      currency: payment.currency,
      dueDate: payment.dueDate,
      description: payment.paymentFor
    });
    await db.addMessage({
      channel: "individual",
      playerId: player.id,
      subject: `Invoice issued: ${payment.paymentFor}`,
      body: `Amount ${payment.amount.toLocaleString()} ${payment.currency}, due ${payment.dueDate.slice(0, 10)}.`,
      sentBy: "Finance admin"
    });
  }

  revalidateAdminViews();
  return NextResponse.json({ message: "Payment invoice created", payment }, { status: 201 });
}
