import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  startOfWeek
} from "date-fns";
import type { KitDeliveryStatus, KitOrder, KitOrderPaymentRecord } from "@/lib/kit-order-store";

/**
 * Resolve delivery status defaulting legacy rows (no field) to "pending".
 * Defined here (not in `kit-order-store`) so client components can call it without
 * pulling in fs / persistence code. Server callers may also import this — no I/O.
 */
export function getDeliveryStatus(order: KitOrder): KitDeliveryStatus {
  return order.deliveryStatus === "delivered" ? "delivered" : "pending";
}

export type KitFinancialPaymentStatus = "paid" | "pending" | "partial" | "no_revenue";

export type DerivedKitOrderFinancials = {
  amountPaid: number;
  balance: number;
  paymentStatus: KitFinancialPaymentStatus;
  /** Quantity of kit items (sum of line quantities). */
  kitUnits: number;
  /** Sum of line totals — should match order.totalAmount when data is consistent. */
  linesSum: number;
  /** True when |linesSum - totalAmount| > epsilon. */
  totalsMismatch: boolean;
};

const EPS = 0.01;

function sumPayments(records: KitOrderPaymentRecord[] | undefined): number {
  if (!records?.length) return 0;
  return records.reduce((s, r) => s + (Number.isFinite(r.amount) ? r.amount : 0), 0);
}

/**
 * Derive paid balance from `paymentRecords` and workflow status.
 * - Approved: if records exist, sum them; otherwise treat as full payment at approval.
 * - Pending: sum of payment records only (partials supported).
 * - Rejected / cancelled: no expected revenue (amount paid = sum of records for audit only).
 */
export function deriveKitOrderFinancials(order: KitOrder): DerivedKitOrderFinancials {
  const linesSum = order.lines.reduce((s, l) => s + (l.lineTotal ?? l.unitPrice * l.quantity), 0);
  const roundedLines = Math.round(linesSum * 100) / 100;
  const total = order.totalAmount;
  const totalsMismatch = Math.abs(roundedLines - total) > EPS;

  const recorded = sumPayments(order.paymentRecords);
  let amountPaid = 0;
  let paymentStatus: KitFinancialPaymentStatus = "pending";

  if (order.status === "rejected" || order.status === "cancelled") {
    amountPaid = recorded;
    paymentStatus = "no_revenue";
  } else if (order.status === "approved") {
    amountPaid = recorded > EPS ? recorded : total;
    if (Math.abs(amountPaid - total) <= EPS) paymentStatus = "paid";
    else if (amountPaid > EPS) paymentStatus = "partial";
    else paymentStatus = "paid";
  } else {
    amountPaid = recorded;
    if (amountPaid <= EPS) paymentStatus = "pending";
    else if (Math.abs(amountPaid - total) <= EPS) paymentStatus = "paid";
    else paymentStatus = "partial";
  }

  const balance = Math.max(0, Math.round((total - amountPaid) * 100) / 100);
  const kitUnits = order.lines.reduce((s, l) => s + (l.quantity || 0), 0);

  return {
    amountPaid: Math.round(amountPaid * 100) / 100,
    balance,
    paymentStatus,
    kitUnits,
    linesSum: roundedLines,
    totalsMismatch
  };
}

export type KitFinanceFlattenedLine = {
  orderId: string;
  reference: string;
  parentName: string;
  playerName: string;
  kitType: string;
  size: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  orderTotal: number;
  currency: string;
  orderStatus: KitOrder["status"];
  amountPaid: number;
  balance: number;
  paymentStatus: KitFinancialPaymentStatus;
  submittedAt: string;
  paymentDate: string | null;
  lineIndex: number;
  /** Delivery state (independent of payment). */
  deliveryStatus: KitDeliveryStatus;
  /** ISO date+time of hand-over, when delivered. */
  deliveredAt: string | null;
  /** Admin who marked the order delivered. */
  deliveredBy: string | null;
};

export function flattenOrdersToFinanceLines(orders: KitOrder[]): KitFinanceFlattenedLine[] {
  const rows: KitFinanceFlattenedLine[] = [];
  for (const order of orders) {
    const fin = deriveKitOrderFinancials(order);
    const paymentDate =
      order.status === "approved" && order.approvedAt
        ? order.approvedAt
        : fin.amountPaid > EPS && order.paymentRecords?.length
          ? [...order.paymentRecords].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0]!.recordedAt
          : null;
    const deliveryStatus = getDeliveryStatus(order);
    order.lines.forEach((line, lineIndex) => {
      rows.push({
        orderId: order.id,
        reference: order.reference,
        parentName: order.parentName,
        playerName: order.playerName,
        kitType: line.kitType,
        size: line.size,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
        orderTotal: order.totalAmount,
        currency: order.currency,
        orderStatus: order.status,
        amountPaid: fin.amountPaid,
        balance: fin.balance,
        paymentStatus: fin.paymentStatus,
        submittedAt: order.submittedAt,
        paymentDate,
        lineIndex,
        deliveryStatus,
        deliveredAt: deliveryStatus === "delivered" ? order.deliveredAt ?? null : null,
        deliveredBy: deliveryStatus === "delivered" ? order.deliveredBy ?? null : null
      });
    });
  }
  return rows;
}

export type KitFinancePeriodTotals = {
  today: number;
  week: number;
  month: number;
};

export type KitFinanceSummary = {
  /** Collected revenue (approved orders, full or recorded payments). */
  totalCollected: number;
  /**
   * Sum of approved orders' stored `totalAmount` (what was committed once approved).
   * When {@link outstandingOnApprovedPartials} > 0, this exceeds {@link totalCollected}.
   */
  approvedGrossCommitted: number;
  /** Average collected per approved order (totalCollected ÷ approved count). */
  averageCollectedPerApprovedOrder: number;
  /** Approved orders paid in full (no remaining balance). */
  approvedPaidInFullCount: number;
  /** Approved orders with a recorded partial — balance may remain. */
  approvedPartialPaymentCount: number;
  /** Portion of totalCollected from fully-paid approved orders. */
  collectedFromPaidInFullApproved: number;
  /** Portion of totalCollected from partial-payment approved orders (sum of amount paid only). */
  collectedFromApprovedPartials: number;
  /** Remaining kit balance summed across approved-but-partial orders only. */
  outstandingOnApprovedPartials: number;
  paidOrderCount: number;
  pendingOrderCount: number;
  partialOrderCount: number;
  rejectedOrCancelledCount: number;
  /** Kit line items (sum of quantities) for orders that are not rejected/cancelled. */
  totalKitUnitsOrdered: number;
  /** Orders awaiting payment (pending or partial with balance). */
  unpaidOrPartialOrderCount: number;
  pendingReceivables: number;
  currency: string;
  revenueByPeriod: KitFinancePeriodTotals;
  /** Orders whose line totals do not match stored total (data quality). */
  mismatchOrderCount: number;
  /**
   * Delivery counts — purely operational; do not feed into receivables / collected /
   * pending payment numbers above. Rejected & cancelled orders are excluded.
   */
  deliveredOrderCount: number;
  pendingDeliveryOrderCount: number;
};

export type KitRevenueByKitType = { kitType: string; revenue: number; units: number };

export type KitFinanceInsights = {
  revenueByKitType: KitRevenueByKitType[];
  bestSellingKits: KitRevenueByKitType[];
  pendingReceivables: number;
  pendingByParent: { parentName: string; email: string; balance: number; orderCount: number }[];
};

export function computeKitFinanceSummary(orders: KitOrder[]): KitFinanceSummary {
  const currency = orders[0]?.currency ?? "RWF";
  const now = new Date();
  const day0 = startOfDay(now);
  const day1 = endOfDay(now);
  const w0 = startOfWeek(now, { weekStartsOn: 1 });
  const w1 = endOfWeek(now, { weekStartsOn: 1 });
  const m0 = startOfMonth(now);
  const m1 = endOfMonth(now);

  let totalCollected = 0;
  let paidOrderCount = 0;
  let pendingOrderCount = 0;
  let partialOrderCount = 0;
  let rejectedOrCancelledCount = 0;
  let totalKitUnitsOrdered = 0;
  let pendingReceivables = 0;
  let mismatchOrderCount = 0;
  let revenueToday = 0;
  let revenueWeek = 0;
  let revenueMonth = 0;

  let unpaidOrPartialOrderCount = 0;
  let deliveredOrderCount = 0;
  let pendingDeliveryOrderCount = 0;

  let approvedGrossCommitted = 0;
  let collectedFromPaidInFullApproved = 0;
  let collectedFromApprovedPartials = 0;
  let outstandingOnApprovedPartials = 0;
  let approvedPaidInFullCount = 0;
  let approvedPartialPaymentCount = 0;

  for (const order of orders) {
    const fin = deriveKitOrderFinancials(order);
    if (fin.totalsMismatch) mismatchOrderCount += 1;

    if (order.status === "rejected" || order.status === "cancelled") {
      rejectedOrCancelledCount += 1;
      continue;
    }

    totalKitUnitsOrdered += fin.kitUnits;
    if (getDeliveryStatus(order) === "delivered") deliveredOrderCount += 1;
    else pendingDeliveryOrderCount += 1;

    if (fin.paymentStatus === "partial") partialOrderCount += 1;

    if (order.status === "approved") {
      paidOrderCount += 1;
      approvedGrossCommitted += order.totalAmount;
      totalCollected += fin.amountPaid;
      if (fin.paymentStatus === "partial") {
        approvedPartialPaymentCount += 1;
        collectedFromApprovedPartials += fin.amountPaid;
        outstandingOnApprovedPartials += fin.balance;
      } else {
        approvedPaidInFullCount += 1;
        collectedFromPaidInFullApproved += fin.amountPaid;
      }
      const at = order.approvedAt ? new Date(order.approvedAt) : null;
      if (at) {
        if (isWithinInterval(at, { start: day0, end: day1 })) revenueToday += fin.amountPaid;
        if (isWithinInterval(at, { start: w0, end: w1 })) revenueWeek += fin.amountPaid;
        if (isWithinInterval(at, { start: m0, end: m1 })) revenueMonth += fin.amountPaid;
      }
    } else if (order.status === "pending_payment_approval") {
      pendingOrderCount += 1;
      pendingReceivables += fin.balance;
      if (fin.balance > EPS || fin.paymentStatus === "partial") unpaidOrPartialOrderCount += 1;
    }
  }

  const averageCollectedPerApprovedOrder =
    paidOrderCount > 0 ? Math.round((totalCollected / paidOrderCount) * 100) / 100 : 0;

  return {
    totalCollected: Math.round(totalCollected * 100) / 100,
    approvedGrossCommitted: Math.round(approvedGrossCommitted * 100) / 100,
    averageCollectedPerApprovedOrder,
    approvedPaidInFullCount,
    approvedPartialPaymentCount,
    collectedFromPaidInFullApproved: Math.round(collectedFromPaidInFullApproved * 100) / 100,
    collectedFromApprovedPartials: Math.round(collectedFromApprovedPartials * 100) / 100,
    outstandingOnApprovedPartials: Math.round(outstandingOnApprovedPartials * 100) / 100,
    paidOrderCount,
    pendingOrderCount,
    partialOrderCount,
    rejectedOrCancelledCount,
    totalKitUnitsOrdered,
    unpaidOrPartialOrderCount,
    pendingReceivables: Math.round(pendingReceivables * 100) / 100,
    currency,
    revenueByPeriod: {
      today: Math.round(revenueToday * 100) / 100,
      week: Math.round(revenueWeek * 100) / 100,
      month: Math.round(revenueMonth * 100) / 100
    },
    mismatchOrderCount,
    deliveredOrderCount,
    pendingDeliveryOrderCount
  };
}

export function computeKitFinanceInsights(orders: KitOrder[]): KitFinanceInsights {
  const byType = new Map<string, { revenue: number; units: number }>();
  for (const order of orders) {
    if (order.status !== "approved") continue;
    const fin = deriveKitOrderFinancials(order);
    const lineSum = order.lines.reduce((s, l) => s + l.lineTotal, 0);
    const share = lineSum > EPS ? fin.amountPaid / lineSum : 0;
    for (const line of order.lines) {
      const key = line.kitType;
      const prev = byType.get(key) ?? { revenue: 0, units: 0 };
      const lineShare = line.lineTotal * share;
      prev.revenue += lineShare;
      prev.units += line.quantity;
      byType.set(key, prev);
    }
  }
  const revenueByKitType: KitRevenueByKitType[] = [...byType.entries()]
    .map(([kitType, v]) => ({
      kitType,
      revenue: Math.round(v.revenue * 100) / 100,
      units: v.units
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const bestSellingKits = [...revenueByKitType].sort((a, b) => b.units - a.units).slice(0, 8);

  let pendingReceivables = 0;
  const parentMap = new Map<string, { parentName: string; email: string; balance: number; orderCount: number }>();
  for (const order of orders) {
    if (order.status !== "pending_payment_approval") continue;
    const fin = deriveKitOrderFinancials(order);
    pendingReceivables += fin.balance;
    const key = order.parentEmail.toLowerCase();
    const prev = parentMap.get(key) ?? {
      parentName: order.parentName,
      email: order.parentEmail,
      balance: 0,
      orderCount: 0
    };
    prev.balance += fin.balance;
    prev.orderCount += 1;
    parentMap.set(key, prev);
  }

  const pendingByParent = [...parentMap.values()]
    .filter((p) => p.balance > EPS)
    .sort((a, b) => b.balance - a.balance);

  return {
    revenueByKitType,
    bestSellingKits,
    pendingReceivables: Math.round(pendingReceivables * 100) / 100,
    pendingByParent
  };
}

/** Build display-ready payment timeline (records + synthetic approval row for legacy orders without records). */
export function buildKitOrderPaymentHistory(order: KitOrder): KitOrderPaymentRecord[] {
  const records = [...(order.paymentRecords ?? [])];
  if (order.status === "approved" && order.approvedAt && records.length === 0) {
    records.push({
      id: `legacy-approval-${order.id}`,
      amount: order.totalAmount,
      recordedAt: order.approvedAt,
      note: "Payment approved",
      recordedBy: order.approvedBy ?? "Admin"
    });
  }
  return records.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
}
