/**
 * Kit order persistence — append / update only.
 * Do not add hard-delete APIs: every submission, payment record, and status change must remain auditable.
 */
import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export type KitOrderLine = {
  kitId: string;
  kitType: string;
  color: string;
  size: string;
  quantity: number;
  /** Unit price captured at submission time so historical orders are immutable. */
  unitPrice: number;
  lineTotal: number;
  photoUrl?: string;
};

export type KitOrderStatus =
  | "pending_payment_approval"
  | "approved"
  | "rejected"
  | "cancelled";

/** Optional ledger of payments (partials or multiple instalments). When empty, finance helpers infer from status. */
export type KitOrderPaymentRecord = {
  id: string;
  amount: number;
  recordedAt: string;
  note?: string;
  recordedBy?: string;
};

/**
 * Delivery state — independent from payment workflow.
 * - "pending": kit has not been handed over yet (default).
 * - "delivered": admin confirmed hand-over to parent/player at deliveredAt.
 *
 * Important: delivery status MUST NOT affect any payment / receivable / collection
 * calculation. A paid order can still be pending delivery; a delivered order can
 * still be unpaid (admin discretion). Finance helpers ignore delivery fields.
 */
export type KitDeliveryStatus = "pending" | "delivered";

/** Audit entry appended each time the admin changes delivery status — never deleted. */
export type KitOrderDeliveryEvent = {
  id: string;
  kind: "delivered" | "reverted";
  at: string;
  by?: string;
  note?: string;
};

export type KitOrder = {
  id: string;
  /** Short human-readable reference (e.g. "KIT-2026-000123"). */
  reference: string;
  accountId: string;
  parentName: string;
  parentEmail: string;
  parentPhone?: string;
  playerId: string;
  playerName: string;
  playerGroup?: string;
  lines: KitOrderLine[];
  totalAmount: number;
  currency: string;
  status: KitOrderStatus;
  submittedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
  adminNotes?: string;
  /** Notification surfaced inside the parent portal until the parent views it. */
  parentNotification?: {
    kind: "approved" | "rejected";
    message: string;
    issuedAt: string;
    /** Set when the parent has dismissed (or viewed) the notification. */
    acknowledgedAt?: string;
  };
  /** Confirmed payments (e.g. partials before approval). New approvals append a full-balance record. */
  paymentRecords?: KitOrderPaymentRecord[];
  /**
   * Delivery tracking. Defaults to "pending" when omitted (legacy orders).
   * The finance / payment derivations do not look at these fields.
   */
  deliveryStatus?: KitDeliveryStatus;
  /** ISO date+time the kit was handed over (set by the "Mark as delivered" admin action). */
  deliveredAt?: string;
  /** Admin actor that flipped delivery status to "delivered". */
  deliveredBy?: string;
  /** Optional free-text note kept with the most recent delivery update (e.g. "left at front desk"). */
  deliveryNote?: string;
  /** Append-only audit trail of every delivery change. Never modified or deleted. */
  deliveryHistory?: KitOrderDeliveryEvent[];
};

const DIR = path.join(process.cwd(), "public", "uploads", "kit-orders");
const FILE = path.join(DIR, "orders.json");

/** Academy currency. Coerced on read so historical orders display consistently. */
const ACADEMY_CURRENCY = "RWF";

async function ensureFile(): Promise<KitOrder[]> {
  await mkdir(DIR, { recursive: true });
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((o): o is KitOrder => Boolean(o && typeof o === "object" && o.id))
      .map((o) => ({ ...o, currency: ACADEMY_CURRENCY }));
  } catch {
    try {
      await rename(FILE, path.join(DIR, `orders.invalid-${Date.now()}.json`));
    } catch {
      /* no existing file */
    }
    await writeFile(FILE, "[]", "utf8");
    return [];
  }
}

async function writeStore(items: KitOrder[]): Promise<void> {
  await mkdir(DIR, { recursive: true });
  await writeFile(FILE, JSON.stringify(items, null, 2), "utf8");
}

function buildReference(existing: KitOrder[]): string {
  const year = new Date().getFullYear();
  const yearOrders = existing.filter((o) => o.reference.startsWith(`KIT-${year}-`)).length;
  const seq = String(yearOrders + 1).padStart(5, "0");
  return `KIT-${year}-${seq}`;
}

export async function listOrders(opts?: { accountId?: string; status?: KitOrderStatus | "all" }): Promise<KitOrder[]> {
  const all = await ensureFile();
  let filtered = all;
  if (opts?.accountId) filtered = filtered.filter((o) => o.accountId === opts.accountId);
  if (opts?.status && opts.status !== "all") filtered = filtered.filter((o) => o.status === opts.status);
  return [...filtered].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

export async function getOrder(id: string): Promise<KitOrder | null> {
  const all = await ensureFile();
  return all.find((o) => o.id === id) ?? null;
}

export type CreateOrderInput = Omit<
  KitOrder,
  "id" | "reference" | "status" | "submittedAt" | "approvedAt" | "approvedBy" | "rejectedAt" | "rejectedBy" | "parentNotification"
>;

export async function createOrder(input: CreateOrderInput): Promise<KitOrder> {
  const all = await ensureFile();
  const order: KitOrder = {
    ...input,
    currency: ACADEMY_CURRENCY,
    id: randomUUID(),
    reference: buildReference(all),
    status: "pending_payment_approval",
    submittedAt: new Date().toISOString()
  };
  all.push(order);
  await writeStore(all);
  return order;
}

export async function updateOrder(id: string, patch: Partial<KitOrder>): Promise<KitOrder | null> {
  const all = await ensureFile();
  const idx = all.findIndex((o) => o.id === id);
  if (idx < 0) return null;
  const next: KitOrder = { ...all[idx], ...patch, id: all[idx].id };
  all[idx] = next;
  await writeStore(all);
  return next;
}

/**
 * Anti-duplicate guard for parents accidentally double-clicking "Send Order":
 * any order from the same parent + player with the same total amount within the
 * last 30 seconds is treated as the same submission.
 */
export async function findRecentDuplicate(input: {
  accountId: string;
  playerId: string;
  totalAmount: number;
  withinSeconds?: number;
}): Promise<KitOrder | null> {
  const seconds = input.withinSeconds ?? 30;
  const cutoff = Date.now() - seconds * 1000;
  const all = await ensureFile();
  return (
    all.find(
      (o) =>
        o.accountId === input.accountId &&
        o.playerId === input.playerId &&
        Math.abs(o.totalAmount - input.totalAmount) < 0.005 &&
        new Date(o.submittedAt).getTime() >= cutoff
    ) ?? null
  );
}

export async function acknowledgeNotification(orderId: string): Promise<KitOrder | null> {
  const order = await getOrder(orderId);
  if (!order || !order.parentNotification) return order;
  if (order.parentNotification.acknowledgedAt) return order;
  return updateOrder(orderId, {
    parentNotification: { ...order.parentNotification, acknowledgedAt: new Date().toISOString() }
  });
}
