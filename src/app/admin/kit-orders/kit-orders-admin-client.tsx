"use client";

import clsx from "clsx";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { AdminOverviewRefreshDetail } from "@/lib/admin-client-events";
import { useAdminOverviewRefresh } from "@/lib/use-admin-overview-refresh";
import { SystemNotice } from "@/components/system/system-notice";
import { adminApiFetch, formatAdminApiMessage } from "@/lib/admin-api-fetch";
import { formatAcademyMoney } from "@/lib/finance-format";
import { getDeliveryStatus } from "@/lib/kit-order-finance";
import type { KitDeliveryStatus, KitOrder, KitOrderStatus } from "@/lib/kit-order-store";

type Notice = { variant: "info" | "success" | "warning" | "error"; message: string } | null;

const STATUS_LABEL: Record<KitOrderStatus, string> = {
  pending_payment_approval: "Pending payment",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled"
};

const STATUS_TONE: Record<KitOrderStatus, string> = {
  pending_payment_approval: "kit-status-pill--pending",
  approved: "kit-status-pill--approved",
  rejected: "kit-status-pill--rejected",
  cancelled: "kit-status-pill--cancelled"
};

const DELIVERY_LABEL: Record<KitDeliveryStatus, string> = {
  delivered: "Delivered",
  pending: "Pending delivery"
};

const DELIVERY_TONE: Record<KitDeliveryStatus, string> = {
  delivered: "kit-status-pill--approved",
  pending: "kit-status-pill--pending"
};

function formatDeliveryAt(iso: string | undefined | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

type Filter =
  | "pending"
  | "approved"
  | "rejected"
  | "all"
  | "pending_delivery"
  | "delivered";

export function KitOrdersAdminClient() {
  /** Default to full queue — parents often see approved orders while admin was stuck on empty “pending” tab. */
  const [filter, setFilter] = useState<Filter>("all");
  const [orders, setOrders] = useState<KitOrder[]>([]);
  const [counts, setCounts] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deliveryBusyId, setDeliveryBusyId] = useState<string | null>(null);

  const refresh = useCallback(async (detail?: AdminOverviewRefreshDetail) => {
    const silent = Boolean(detail?.silent);
    if (!silent) setLoading(true);
    try {
      /** Server filters by workflow status only — delivery filtering is applied client-side below. */
      const workflowStatus =
        filter === "pending"
          ? "pending_payment_approval"
          : filter === "approved" || filter === "rejected"
            ? filter
            : "all";
      const res = await adminApiFetch(`/api/admin/kit-orders?status=${workflowStatus}`);
      const data = await res.json();
      if (!res.ok) throw new Error(formatAdminApiMessage(res.status, data?.message));
      setOrders(Array.isArray(data?.orders) ? data.orders : []);
      if (data?.counts) setCounts(data.counts);
    } catch (e) {
      if (!silent) setNotice({ variant: "error", message: e instanceof Error ? e.message : "Could not load kit orders." });
    } finally {
      if (!silent) setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useAdminOverviewRefresh(refresh);

  const approve = async (order: KitOrder) => {
    if (busyId) return;
    setBusyId(order.id);
    setNotice(null);
    try {
      const res = await adminApiFetch(`/api/admin/kit-orders/${order.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "approve" })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatAdminApiMessage(res.status, data?.message));
      setNotice({ variant: "success", message: data.message ?? "Approved." });
      await refresh();
    } catch (e) {
      setNotice({ variant: "error", message: e instanceof Error ? e.message : "Could not approve order." });
    } finally {
      setBusyId(null);
    }
  };

  const markDelivery = async (order: KitOrder, next: KitDeliveryStatus) => {
    if (deliveryBusyId) return;
    setDeliveryBusyId(order.id);
    setNotice(null);
    try {
      const action = next === "delivered" ? "mark_delivered" : "mark_pending_delivery";
      const res = await adminApiFetch(`/api/admin/kit-orders/${order.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatAdminApiMessage(res.status, data?.message));
      setOrders((prev) => prev.map((o) => (o.id === order.id && data?.order ? data.order : o)));
      setNotice({
        variant: "success",
        message: data.message ?? (next === "delivered" ? "Marked delivered." : "Reverted to pending delivery.")
      });
    } catch (e) {
      setNotice({ variant: "error", message: e instanceof Error ? e.message : "Could not update delivery status." });
    } finally {
      setDeliveryBusyId(null);
    }
  };

  const reject = async (order: KitOrder) => {
    if (busyId) return;
    let reason = "";
    if (typeof window !== "undefined") {
      reason = window.prompt("Reason for rejecting this order? (Visible to the parent)") ?? "";
      if (!reason.trim()) return;
    }
    setBusyId(order.id);
    setNotice(null);
    try {
      const res = await adminApiFetch(`/api/admin/kit-orders/${order.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "reject", reason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatAdminApiMessage(res.status, data?.message));
      setNotice({ variant: "info", message: data.message ?? "Rejected." });
      await refresh();
    } catch (e) {
      setNotice({ variant: "error", message: e instanceof Error ? e.message : "Could not reject order." });
    } finally {
      setBusyId(null);
    }
  };

  const formatMoney = (amount: number, currency: string) => formatAcademyMoney(amount, currency || "RWF");

  /** Apply delivery filter on top of workflow-status filter coming from the server. */
  const visibleOrders =
    filter === "pending_delivery"
      ? orders.filter((o) => getDeliveryStatus(o) === "pending")
      : filter === "delivered"
        ? orders.filter((o) => getDeliveryStatus(o) === "delivered")
        : orders;

  const deliveryCounts = orders.reduce(
    (acc, o) => {
      if (getDeliveryStatus(o) === "delivered") acc.delivered += 1;
      else acc.pending += 1;
      return acc;
    },
    { delivered: 0, pending: 0 }
  );

  return (
    <div className="kit-orders-root">
      <header className="kit-orders-hero">
        <div>
          <p className="kit-admin-eyebrow">Kit ordering</p>
          <h2 className="kit-admin-title">Kit orders</h2>
          <p className="kit-admin-sub">
            Review submissions, confirm payment off-platform, then approve to notify the parent. Orders and payment records
            are never deleted — only status updates.
          </p>
          <p className="kit-admin-sub">
            <Link href="/admin/kit-orders/finance" className="kit-fin-inline-link">
              Open kit finances dashboard →
            </Link>
          </p>
        </div>
        <div className="kit-orders-counts">
          <div className="kit-orders-count">
            <span className="kit-orders-count-num">{counts.pending}</span>
            <span className="kit-orders-count-label">Pending</span>
          </div>
          <div className="kit-orders-count">
            <span className="kit-orders-count-num">{counts.approved}</span>
            <span className="kit-orders-count-label">Approved</span>
          </div>
          <div className="kit-orders-count">
            <span className="kit-orders-count-num">{counts.rejected}</span>
            <span className="kit-orders-count-label">Rejected</span>
          </div>
          <div className="kit-orders-count">
            <span className="kit-orders-count-num">{deliveryCounts.pending}</span>
            <span className="kit-orders-count-label">Pending delivery</span>
          </div>
          <div className="kit-orders-count">
            <span className="kit-orders-count-num">{deliveryCounts.delivered}</span>
            <span className="kit-orders-count-label">Delivered</span>
          </div>
        </div>
      </header>

      <div className="kit-orders-tabs" role="tablist" aria-label="Filter orders">
        {(["pending", "approved", "rejected", "pending_delivery", "delivered", "all"] as Filter[]).map((f) => {
          const label =
            f === "all"
              ? "All"
              : f === "pending"
                ? "Pending payment"
                : f === "approved"
                  ? "Approved"
                  : f === "rejected"
                    ? "Rejected"
                    : f === "pending_delivery"
                      ? "Pending delivery"
                      : "Delivered";
          return (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              className={clsx("kit-orders-tab", filter === f && "kit-orders-tab--active")}
              onClick={() => setFilter(f)}
            >
              {label}
            </button>
          );
        })}
      </div>

      {notice ? (
        <SystemNotice variant={notice.variant} title={notice.variant === "error" ? "Error" : undefined}>
          {notice.message}
        </SystemNotice>
      ) : null}

      {loading ? (
        <p className="kit-admin-empty">Loading orders…</p>
      ) : visibleOrders.length === 0 ? (
        <p className="kit-admin-empty">
          {filter === "pending" && counts.total > 0 && counts.pending === 0 ? (
            <>
              No orders awaiting payment right now. These parents may already have approved orders — open the{" "}
              <strong>Approved</strong> or <strong>All</strong> tab (counts above are for the whole academy, not only this
              tab).
            </>
          ) : filter === "pending_delivery" ? (
            <>No orders are currently pending delivery.</>
          ) : filter === "delivered" ? (
            <>No orders have been marked as delivered yet.</>
          ) : (
            <>No orders match this filter yet.</>
          )}
        </p>
      ) : (
        <div className="kit-orders-list">
          {visibleOrders.map((order) => {
            const deliveryStatus = getDeliveryStatus(order);
            const deliveryWorking = deliveryBusyId === order.id;
            return (
            <article key={order.id} className="kit-order-card">
              <header className="kit-order-card-head">
                <div>
                  <p className="kit-order-ref">{order.reference}</p>
                  <p className="kit-order-when">Submitted {new Date(order.submittedAt).toLocaleString()}</p>
                </div>
                <div className="kit-order-card-pills">
                  <span className={clsx("kit-status-pill", STATUS_TONE[order.status])}>{STATUS_LABEL[order.status]}</span>
                  <span className={clsx("kit-status-pill", DELIVERY_TONE[deliveryStatus])}>
                    {DELIVERY_LABEL[deliveryStatus]}
                  </span>
                </div>
              </header>

              <dl className="kit-order-meta">
                <div>
                  <dt>Parent</dt>
                  <dd>
                    <strong>{order.parentName}</strong>
                    <br />
                    <a href={`mailto:${order.parentEmail}`}>{order.parentEmail}</a>
                    {order.parentPhone ? <span className="kit-order-meta-mini"> · {order.parentPhone}</span> : null}
                  </dd>
                </div>
                <div>
                  <dt>Player</dt>
                  <dd>
                    <strong>{order.playerName}</strong>
                    {order.playerGroup ? <span className="kit-order-meta-mini"> · {order.playerGroup}</span> : null}
                  </dd>
                </div>
                <div>
                  <dt>Total</dt>
                  <dd>
                    <strong>{formatMoney(order.totalAmount, order.currency)}</strong>
                  </dd>
                </div>
              </dl>

              <table className="kit-order-table">
                <thead>
                  <tr>
                    <th scope="col">Kit</th>
                    <th scope="col">Size</th>
                    <th scope="col">Qty</th>
                    <th scope="col">Unit</th>
                    <th scope="col">Line</th>
                  </tr>
                </thead>
                <tbody>
                  {order.lines.map((l, idx) => (
                    <tr key={`${order.id}-${idx}`}>
                      <td>
                        {l.kitType} <span className="kit-order-line-color">— {l.color}</span>
                      </td>
                      <td>{l.size}</td>
                      <td>{l.quantity}</td>
                      <td>{formatMoney(l.unitPrice, order.currency)}</td>
                      <td>{formatMoney(l.lineTotal, order.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {order.status === "rejected" && order.rejectionReason ? (
                <p className="kit-order-reason">Rejection reason: {order.rejectionReason}</p>
              ) : null}

              {order.status === "approved" && order.approvedAt ? (
                <p className="kit-order-approved">
                  Approved {new Date(order.approvedAt).toLocaleString()} {order.approvedBy ? `by ${order.approvedBy}` : null}
                </p>
              ) : null}

              <section className="kit-order-delivery" aria-label="Delivery information">
                <h4 className="kit-order-delivery-title">Delivery</h4>
                <dl className="kit-order-delivery-grid">
                  <div>
                    <dt>Status</dt>
                    <dd>
                      <span className={clsx("kit-status-pill", DELIVERY_TONE[deliveryStatus])}>
                        {DELIVERY_LABEL[deliveryStatus]}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt>Delivered on</dt>
                    <dd>{deliveryStatus === "delivered" ? formatDeliveryAt(order.deliveredAt) : "—"}</dd>
                  </div>
                  <div>
                    <dt>By</dt>
                    <dd>{deliveryStatus === "delivered" ? order.deliveredBy ?? "—" : "—"}</dd>
                  </div>
                </dl>
                <p className="kit-order-delivery-hint">
                  Delivery is tracked separately from payment — paid kits can still be pending delivery.
                </p>
              </section>

              <div className="kit-order-actions">
                {order.status === "pending_payment_approval" ? (
                  <>
                    <button
                      type="button"
                      className="btn admin-btn--primary"
                      onClick={() => approve(order)}
                      disabled={busyId === order.id}
                      aria-busy={busyId === order.id}
                    >
                      Approve payment
                    </button>
                    <button
                      type="button"
                      className="btn finance-void-btn"
                      onClick={() => reject(order)}
                      disabled={busyId === order.id}
                    >
                      Reject
                    </button>
                  </>
                ) : null}

                {deliveryStatus === "pending" ? (
                  <button
                    type="button"
                    className="btn admin-btn--primary"
                    onClick={() => markDelivery(order, "delivered")}
                    disabled={deliveryWorking}
                    aria-busy={deliveryWorking}
                  >
                    {deliveryWorking ? "Saving…" : "Mark as delivered"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => markDelivery(order, "pending")}
                    disabled={deliveryWorking}
                    aria-busy={deliveryWorking}
                    title="Move back to pending delivery"
                  >
                    {deliveryWorking ? "Saving…" : "Revert to pending delivery"}
                  </button>
                )}
              </div>
            </article>
          );
          })}
        </div>
      )}
    </div>
  );
}
