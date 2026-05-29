"use client";

import clsx from "clsx";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AdminOverviewRefreshDetail } from "@/lib/admin-client-events";
import { useAdminOverviewRefresh } from "@/lib/use-admin-overview-refresh";
import { SystemNotice } from "@/components/system/system-notice";
import { adminApiFetch, formatAdminApiMessage } from "@/lib/admin-api-fetch";
import { formatAcademyMoney, formatShortDate } from "@/lib/finance-format";
import {
  buildKitOrderPaymentHistory,
  getDeliveryStatus,
  type KitFinanceInsights,
  type KitFinanceSummary,
  type KitFinancialPaymentStatus,
  flattenOrdersToFinanceLines
} from "@/lib/kit-order-finance";
import type { KitDeliveryStatus, KitOrder } from "@/lib/kit-order-store";

const PAGE_SIZE = 25;

const PAYMENT_LABEL: Record<KitFinancialPaymentStatus, string> = {
  paid: "Paid",
  pending: "Pending",
  partial: "Partially paid",
  no_revenue: "No revenue"
};

const PAYMENT_PILL: Record<KitFinancialPaymentStatus, string> = {
  paid: "kit-fin-pill--paid",
  pending: "kit-fin-pill--pending",
  partial: "kit-fin-pill--partial",
  no_revenue: "kit-fin-pill--muted"
};

const DELIVERY_LABEL: Record<KitDeliveryStatus, string> = {
  delivered: "Delivered",
  pending: "Pending delivery"
};

const DELIVERY_PILL: Record<KitDeliveryStatus, string> = {
  delivered: "kit-fin-pill--paid",
  pending: "kit-fin-pill--pending"
};

/** Format an ISO timestamp as "DD MMM YYYY · HH:mm" using the parent's locale. */
function formatDeliveryAt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

type SortKey = "latest" | "amount_high" | "amount_low";

type PayFilter = "all" | KitFinancialPaymentStatus;

type DeliveryFilter = "all" | KitDeliveryStatus;

export function KitOrdersFinanceClient() {
  const [orders, setOrders] = useState<KitOrder[]>([]);
  const [summary, setSummary] = useState<KitFinanceSummary | null>(null);
  const [insights, setInsights] = useState<KitFinanceInsights | null>(null);
  const [mismatchedReferences, setMismatchedReferences] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [payFilter, setPayFilter] = useState<PayFilter>("all");
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState<SortKey>("latest");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deliveryBusyId, setDeliveryBusyId] = useState<string | null>(null);
  const [deliveryNotice, setDeliveryNotice] = useState<{
    variant: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const load = useCallback(async (detail?: AdminOverviewRefreshDetail) => {
    const silent = Boolean(detail?.silent);
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await adminApiFetch("/api/admin/kit-orders/finance");
      const data = await res.json();
      if (!res.ok) throw new Error(formatAdminApiMessage(res.status, data?.message));
      setOrders(Array.isArray(data.orders) ? data.orders : []);
      setSummary(data.summary ?? null);
      setInsights(data.insights ?? null);
      setMismatchedReferences(Array.isArray(data.mismatchedReferences) ? data.mismatchedReferences : []);
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : "Could not load data.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useAdminOverviewRefresh(load);

  const allLines = useMemo(() => flattenOrdersToFinanceLines(orders), [orders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allLines.filter((row) => {
      if (payFilter !== "all" && row.paymentStatus !== payFilter) return false;
      if (deliveryFilter !== "all" && row.deliveryStatus !== deliveryFilter) return false;
      if (q) {
        const blob = `${row.parentName} ${row.playerName} ${row.reference}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      if (dateFrom && row.submittedAt.slice(0, 10) < dateFrom) return false;
      if (dateTo && row.submittedAt.slice(0, 10) > dateTo) return false;
      return true;
    });
  }, [allLines, search, payFilter, deliveryFilter, dateFrom, dateTo]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    if (sort === "latest") {
      copy.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt) || a.orderId.localeCompare(b.orderId));
    } else if (sort === "amount_high") {
      copy.sort((a, b) => b.orderTotal - a.orderTotal || b.submittedAt.localeCompare(a.submittedAt));
    } else {
      copy.sort((a, b) => a.orderTotal - b.orderTotal || b.submittedAt.localeCompare(a.submittedAt));
    }
    return copy;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages);
  const pageSlice = sorted.slice((pageClamped - 1) * PAGE_SIZE, pageClamped * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, payFilter, deliveryFilter, dateFrom, dateTo, sort]);

  /** Mark / revert delivery in-place from the table or modal — used by both surfaces. */
  const toggleDelivery = useCallback(
    async (orderId: string, nextStatus: KitDeliveryStatus): Promise<KitOrder | null> => {
      if (deliveryBusyId) return null;
      setDeliveryBusyId(orderId);
      setDeliveryNotice(null);
      try {
        const action = nextStatus === "delivered" ? "mark_delivered" : "mark_pending_delivery";
        const res = await adminApiFetch(`/api/admin/kit-orders/${orderId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(formatAdminApiMessage(res.status, data?.message));
        setOrders((prev) => prev.map((o) => (o.id === orderId && data?.order ? data.order : o)));
        setDeliveryNotice({
          variant: "success",
          message: data.message ?? (nextStatus === "delivered" ? "Marked delivered." : "Reverted to pending.")
        });
        return data?.order ?? null;
      } catch (e) {
        setDeliveryNotice({
          variant: "error",
          message: e instanceof Error ? e.message : "Could not update delivery status."
        });
        return null;
      } finally {
        setDeliveryBusyId(null);
      }
    },
    [deliveryBusyId]
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const detailOrder = detailId ? orders.find((o) => o.id === detailId) ?? null : null;

  const fmt = (n: number, c: string) => formatAcademyMoney(n, c || "RWF");

  return (
    <div className="kit-admin-root kit-orders-root kit-fin-root">
      <header className="kit-fin-hero">
        <div>
          <p className="kit-admin-eyebrow">Kit ordering · Finance</p>
          <h2 className="kit-admin-title">Kit orders dashboard</h2>
          <p className="kit-admin-sub">
            Collected revenue, receivables, and line-level detail. Totals follow stored order lines and approval
            workflow (approved orders count as collected unless partial payments are recorded).
          </p>
          <div className="kit-fin-hero-links">
            <Link href="/admin/kit-orders" className="kit-fin-link">
              ← Review &amp; approve orders
            </Link>
            <button type="button" className="kit-fin-link kit-fin-link--btn" onClick={() => load()} disabled={loading}>
              Refresh data
            </button>
          </div>
        </div>
      </header>

      {error ? (
        <SystemNotice variant="error" title="Could not load dashboard">
          {error}
        </SystemNotice>
      ) : null}

      {mismatchedReferences.length > 0 ? (
        <SystemNotice variant="warning" title="Line totals differ from order total">
          References: {mismatchedReferences.join(", ")} — verify prices in the portal submission flow or edit the
          order JSON. Dashboard still uses each order&rsquo;s stored <strong>totalAmount</strong> for balances.
        </SystemNotice>
      ) : null}

      {loading && !summary ? (
        <p className="kit-fin-muted">Loading financial summary…</p>
      ) : summary ? (
        <>
          <section className="kit-fin-cards" aria-label="Financial summary">
            <article className="kit-fin-card kit-fin-card--accent kit-fin-card--hero-collected">
              <header className="kit-fin-collected-head">
                <div>
                  <p className="kit-fin-card-label">Total collected (approved)</p>
                  <p className="kit-fin-card-value">{fmt(summary.totalCollected, summary.currency)}</p>
                  <p className="kit-fin-card-hint">
                    Cash / recorded payments on{" "}
                    <strong>{summary.paidOrderCount}</strong> approved order
                    {summary.paidOrderCount === 1 ? "" : "s"}
                    {summary.paidOrderCount > 0 ? (
                      <>
                        {" "}
                        · avg <strong>{fmt(summary.averageCollectedPerApprovedOrder, summary.currency)}</strong> collected
                        per approved order
                      </>
                    ) : null}
                  </p>
                  <p className="kit-fin-collected-micro">
                    <strong>{fmt(summary.approvedGrossCommitted, summary.currency)}</strong> total approved order value (
                    sum of stored order totals)
                    {summary.outstandingOnApprovedPartials > 0 ? (
                      <>
                        {" "}
                        — still <strong>{fmt(summary.outstandingOnApprovedPartials, summary.currency)}</strong> open on{" "}
                        <strong>{summary.approvedPartialPaymentCount}</strong> approved partial payment
                        {summary.approvedPartialPaymentCount === 1 ? "" : "s"}
                      </>
                    ) : null}
                  </p>
                </div>
              </header>

              <div className="kit-fin-collected-breakdown">
                <div className="kit-fin-collected-metric">
                  <span className="kit-fin-collected-metric-label">Collected — paid in full</span>
                  <span className="kit-fin-collected-metric-val">
                    {fmt(summary.collectedFromPaidInFullApproved, summary.currency)}
                  </span>
                  <span className="kit-fin-collected-metric-sub">
                    {summary.approvedPaidInFullCount} order{summary.approvedPaidInFullCount === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="kit-fin-collected-metric">
                  <span className="kit-fin-collected-metric-label">Collected — partial (approved)</span>
                  <span className="kit-fin-collected-metric-val">
                    {fmt(summary.collectedFromApprovedPartials, summary.currency)}
                  </span>
                  <span className="kit-fin-collected-metric-sub">
                    {summary.approvedPartialPaymentCount} order{summary.approvedPartialPaymentCount === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="kit-fin-collected-metric kit-fin-collected-metric--period">
                  <span className="kit-fin-collected-metric-label">By approval date (this period)</span>
                  <dl className="kit-fin-period-dl">
                    <div>
                      <dt>Today</dt>
                      <dd>{fmt(summary.revenueByPeriod.today, summary.currency)}</dd>
                    </div>
                    <div>
                      <dt>This week</dt>
                      <dd>{fmt(summary.revenueByPeriod.week, summary.currency)}</dd>
                    </div>
                    <div>
                      <dt>This month</dt>
                      <dd>{fmt(summary.revenueByPeriod.month, summary.currency)}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </article>
            <div className="kit-fin-card">
              <p className="kit-fin-card-label">Pending payment</p>
              <p className="kit-fin-card-value">{summary.pendingOrderCount}</p>
              <p className="kit-fin-card-hint">Awaiting approval / unpaid</p>
            </div>
            <div className="kit-fin-card">
              <p className="kit-fin-card-label">Unpaid / partial orders</p>
              <p className="kit-fin-card-value">{summary.unpaidOrPartialOrderCount}</p>
              {summary.partialOrderCount > 0 ? (
                <p className="kit-fin-card-hint">{summary.partialOrderCount} with partial payments</p>
              ) : (
                <p className="kit-fin-card-hint">—</p>
              )}
            </div>
            <div className="kit-fin-card">
              <p className="kit-fin-card-label">Kit units ordered</p>
              <p className="kit-fin-card-value">{summary.totalKitUnitsOrdered}</p>
              <p className="kit-fin-card-hint">Excl. rejected &amp; cancelled</p>
            </div>
            <div className="kit-fin-card kit-fin-card--warn">
              <p className="kit-fin-card-label">Pending receivables</p>
              <p className="kit-fin-card-value">{fmt(summary.pendingReceivables, summary.currency)}</p>
              <p className="kit-fin-card-hint">Outstanding on open orders</p>
            </div>
            <div className="kit-fin-card">
              <p className="kit-fin-card-label">Pending delivery</p>
              <p className="kit-fin-card-value">{summary.pendingDeliveryOrderCount}</p>
              <p className="kit-fin-card-hint">Awaiting hand-over</p>
            </div>
            <div className="kit-fin-card">
              <p className="kit-fin-card-label">Delivered</p>
              <p className="kit-fin-card-value">{summary.deliveredOrderCount}</p>
              <p className="kit-fin-card-hint">Already handed over</p>
            </div>
          </section>
        </>
      ) : null}

      {insights && insights.revenueByKitType.length > 0 ? (
        <section className="kit-fin-insights" aria-label="Revenue insights">
          <div className="kit-fin-insights-grid">
            <div className="kit-fin-panel">
              <h3 className="kit-fin-section-title">Revenue by kit type</h3>
              <p className="kit-fin-panel-sub">Allocated from approved orders (proportional to line totals).</p>
              <ul className="kit-fin-insight-list">
                {insights.revenueByKitType.map((row) => (
                  <li key={row.kitType}>
                    <span>{row.kitType}</span>
                    <span className="kit-fin-insight-metric">
                      {fmt(row.revenue, summary?.currency ?? "RWF")}
                      <span className="kit-fin-muted"> · {row.units} units</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="kit-fin-panel">
              <h3 className="kit-fin-section-title">Best-selling kits</h3>
              <p className="kit-fin-panel-sub">By quantity (approved orders).</p>
              <ul className="kit-fin-insight-list">
                {insights.bestSellingKits.map((row) => (
                  <li key={row.kitType}>
                    <span>{row.kitType}</span>
                    <span className="kit-fin-insight-metric">{row.units} units</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="kit-fin-panel">
              <h3 className="kit-fin-section-title">Largest pending balances</h3>
              <p className="kit-fin-panel-sub">Parents with open kit orders.</p>
              {insights.pendingByParent.length === 0 ? (
                <p className="kit-fin-muted">No pending receivables.</p>
              ) : (
                <ul className="kit-fin-insight-list">
                  {insights.pendingByParent.slice(0, 8).map((p) => (
                    <li key={p.email}>
                      <span>
                        {p.parentName}
                        <span className="kit-fin-muted"> · {p.orderCount} order(s)</span>
                      </span>
                      <span className="kit-fin-insight-metric">{fmt(p.balance, summary?.currency ?? "RWF")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      ) : null}

      <section className="kit-fin-table-section" aria-label="Order lines">
        <h3 className="kit-fin-section-title">All kit lines</h3>
        <div className="kit-fin-toolbar">
          <label className="kit-fin-field">
            <span>Search</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Parent, player, reference…"
              className="kit-fin-input"
            />
          </label>
          <label className="kit-fin-field">
            <span>Payment status</span>
            <select
              className="kit-fin-input"
              value={payFilter}
              onChange={(e) => setPayFilter(e.target.value as PayFilter)}
            >
              <option value="all">All</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="partial">Partially paid</option>
              <option value="no_revenue">No revenue</option>
            </select>
          </label>
          <label className="kit-fin-field">
            <span>Delivery</span>
            <select
              className="kit-fin-input"
              value={deliveryFilter}
              onChange={(e) => setDeliveryFilter(e.target.value as DeliveryFilter)}
            >
              <option value="all">All</option>
              <option value="pending">Pending delivery</option>
              <option value="delivered">Delivered</option>
            </select>
          </label>
          <label className="kit-fin-field">
            <span>From</span>
            <input type="date" className="kit-fin-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label className="kit-fin-field">
            <span>To</span>
            <input type="date" className="kit-fin-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
          <label className="kit-fin-field">
            <span>Sort</span>
            <select className="kit-fin-input" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              <option value="latest">Latest orders</option>
              <option value="amount_high">Highest order total</option>
              <option value="amount_low">Lowest order total</option>
            </select>
          </label>
        </div>

        <p className="kit-fin-muted kit-fin-count">
          Showing {pageSlice.length} of {sorted.length} line(s) · {orders.length} order(s) loaded
        </p>

        {deliveryNotice ? (
          <SystemNotice
            variant={deliveryNotice.variant}
            title={deliveryNotice.variant === "error" ? "Delivery update failed" : "Delivery update"}
          >
            {deliveryNotice.message}
          </SystemNotice>
        ) : null}

        <div className="kit-fin-table-wrap">
          <table className="kit-fin-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Parent</th>
                <th>Player</th>
                <th>Kit</th>
                <th>Size</th>
                <th className="kit-fin-num">Qty</th>
                <th className="kit-fin-num">Unit</th>
                <th className="kit-fin-num">Line</th>
                <th className="kit-fin-num">Order total</th>
                <th>Payment</th>
                <th className="kit-fin-num">Paid</th>
                <th className="kit-fin-num">Balance</th>
                <th>Delivery</th>
                <th>Delivered on</th>
                <th>Ordered</th>
                <th>Paid on</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pageSlice.map((row) => {
                const busy = deliveryBusyId === row.orderId;
                return (
                  <tr key={`${row.orderId}-${row.lineIndex}`} className="kit-fin-tr">
                    <td className="kit-fin-mono">{row.reference}</td>
                    <td>{row.parentName}</td>
                    <td>{row.playerName}</td>
                    <td>{row.kitType}</td>
                    <td>{row.size}</td>
                    <td className="kit-fin-num">{row.quantity}</td>
                    <td className="kit-fin-num">{fmt(row.unitPrice, row.currency)}</td>
                    <td className="kit-fin-num">{fmt(row.lineTotal, row.currency)}</td>
                    <td className="kit-fin-num kit-fin-strong">{fmt(row.orderTotal, row.currency)}</td>
                    <td>
                      <span className={clsx("kit-fin-pill", PAYMENT_PILL[row.paymentStatus])}>
                        {PAYMENT_LABEL[row.paymentStatus]}
                      </span>
                    </td>
                    <td className="kit-fin-num">{fmt(row.amountPaid, row.currency)}</td>
                    <td className="kit-fin-num">{fmt(row.balance, row.currency)}</td>
                    <td>
                      <span className={clsx("kit-fin-pill", DELIVERY_PILL[row.deliveryStatus])}>
                        {DELIVERY_LABEL[row.deliveryStatus]}
                      </span>
                    </td>
                    <td>{row.deliveryStatus === "delivered" ? formatDeliveryAt(row.deliveredAt) : "—"}</td>
                    <td>{formatShortDate(row.submittedAt)}</td>
                    <td>{row.paymentDate ? formatShortDate(row.paymentDate) : "—"}</td>
                    <td>
                      <div className="kit-fin-row-actions">
                        {row.deliveryStatus === "pending" ? (
                          <button
                            type="button"
                            className="kit-fin-mini-btn"
                            onClick={() => toggleDelivery(row.orderId, "delivered")}
                            disabled={busy}
                            aria-busy={busy}
                          >
                            {busy ? "Saving…" : "Mark delivered"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="kit-fin-mini-btn kit-fin-mini-btn--ghost"
                            onClick={() => toggleDelivery(row.orderId, "pending")}
                            disabled={busy}
                            aria-busy={busy}
                            title="Move back to pending delivery"
                          >
                            {busy ? "Saving…" : "Revert"}
                          </button>
                        )}
                        <button type="button" className="kit-fin-mini-btn" onClick={() => setDetailId(row.orderId)}>
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 ? (
          <nav className="kit-fin-pager" aria-label="Pagination">
            <button
              type="button"
              className="kit-fin-pager-btn"
              disabled={pageClamped <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span className="kit-fin-pager-status">
              Page {pageClamped} / {totalPages}
            </span>
            <button
              type="button"
              className="kit-fin-pager-btn"
              disabled={pageClamped >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </nav>
        ) : null}
      </section>

      {detailOrder ? (
        <KitOrderFinanceDetail
          order={detailOrder}
          onClose={() => setDetailId(null)}
          onToggleDelivery={(next) => toggleDelivery(detailOrder.id, next)}
          deliveryBusy={deliveryBusyId === detailOrder.id}
        />
      ) : null}
    </div>
  );
}

function KitOrderFinanceDetail({
  order,
  onClose,
  onToggleDelivery,
  deliveryBusy
}: {
  order: KitOrder;
  onClose: () => void;
  onToggleDelivery: (next: KitDeliveryStatus) => Promise<KitOrder | null>;
  deliveryBusy: boolean;
}) {
  const history = useMemo(() => buildKitOrderPaymentHistory(order), [order]);
  const linesSum = order.lines.reduce((s, l) => s + l.lineTotal, 0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fmt = (n: number) => formatAcademyMoney(n, order.currency || "RWF");

  return (
    <div className="kit-fin-modal-root" role="dialog" aria-modal aria-labelledby="kit-fin-detail-title">
      <button type="button" className="kit-fin-modal-backdrop" aria-label="Close" onClick={onClose} />
      <div className="kit-fin-modal">
        <header className="kit-fin-modal-head">
          <div>
            <p className="kit-fin-modal-eyebrow">{order.reference}</p>
            <h2 id="kit-fin-detail-title" className="kit-fin-modal-title">
              Order detail
            </h2>
            <p className="kit-fin-modal-sub">
              Submitted {formatShortDate(order.submittedAt)}
              {order.approvedAt ? ` · Approved ${formatShortDate(order.approvedAt)}` : ""}
            </p>
          </div>
          <button type="button" className="kit-fin-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="kit-fin-modal-body">
          <section className="kit-fin-detail-block">
            <h3>Parent</h3>
            <dl className="kit-fin-dl">
              <div>
                <dt>Name</dt>
                <dd>{order.parentName}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>
                  <a href={`mailto:${order.parentEmail}`}>{order.parentEmail}</a>
                </dd>
              </div>
              {order.parentPhone ? (
                <div>
                  <dt>Phone</dt>
                  <dd>{order.parentPhone}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="kit-fin-detail-block">
            <h3>Player</h3>
            <dl className="kit-fin-dl">
              <div>
                <dt>Name</dt>
                <dd>{order.playerName}</dd>
              </div>
              {order.playerGroup ? (
                <div>
                  <dt>Group</dt>
                  <dd>{order.playerGroup}</dd>
                </div>
              ) : null}
              <div>
                <dt>Player ID</dt>
                <dd className="kit-fin-mono">{order.playerId}</dd>
              </div>
            </dl>
          </section>

          <section className="kit-fin-detail-block">
            <h3>Workflow</h3>
            <p className="kit-fin-status-badge">{order.status.replace(/_/g, " ")}</p>
            {order.rejectionReason ? <p className="kit-fin-reason">{order.rejectionReason}</p> : null}
            {order.adminNotes ? <p className="kit-fin-notes">Admin notes: {order.adminNotes}</p> : null}
          </section>

          <section className="kit-fin-detail-block">
            <h3>Delivery information</h3>
            <p className="kit-fin-panel-sub">
              Delivery is tracked separately from payment — paid kits can still be pending delivery.
            </p>
            {(() => {
              const status = getDeliveryStatus(order);
              return (
                <>
                  <dl className="kit-fin-dl">
                    <div>
                      <dt>Status</dt>
                      <dd>
                        <span className={clsx("kit-fin-pill", DELIVERY_PILL[status])}>
                          {DELIVERY_LABEL[status]}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt>Delivered on</dt>
                      <dd>{status === "delivered" ? formatDeliveryAt(order.deliveredAt) : "—"}</dd>
                    </div>
                    <div>
                      <dt>Updated by</dt>
                      <dd>{status === "delivered" ? order.deliveredBy ?? "—" : "—"}</dd>
                    </div>
                    {order.deliveryNote ? (
                      <div>
                        <dt>Note</dt>
                        <dd>{order.deliveryNote}</dd>
                      </div>
                    ) : null}
                  </dl>
                  <div className="kit-fin-delivery-actions">
                    {status === "pending" ? (
                      <button
                        type="button"
                        className="btn admin-btn--primary"
                        onClick={() => onToggleDelivery("delivered")}
                        disabled={deliveryBusy}
                        aria-busy={deliveryBusy}
                      >
                        {deliveryBusy ? "Saving…" : "Mark as delivered"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn"
                        onClick={() => onToggleDelivery("pending")}
                        disabled={deliveryBusy}
                        aria-busy={deliveryBusy}
                      >
                        {deliveryBusy ? "Saving…" : "Revert to pending delivery"}
                      </button>
                    )}
                  </div>
                  {order.deliveryHistory && order.deliveryHistory.length > 0 ? (
                    <details className="kit-fin-delivery-history">
                      <summary>Delivery audit ({order.deliveryHistory.length})</summary>
                      <ul className="kit-fin-pay-list">
                        {[...order.deliveryHistory]
                          .sort((a, b) => b.at.localeCompare(a.at))
                          .map((h) => (
                            <li key={h.id}>
                              <div>
                                <strong>{h.kind === "delivered" ? "Delivered" : "Reverted to pending"}</strong>
                                <span className="kit-fin-muted"> · {formatDeliveryAt(h.at)}</span>
                              </div>
                              <div className="kit-fin-muted">
                                {h.by ? `by ${h.by}` : "by Admin"}
                                {h.note ? ` — ${h.note}` : ""}
                              </div>
                            </li>
                          ))}
                      </ul>
                    </details>
                  ) : null}
                </>
              );
            })()}
          </section>

          <section className="kit-fin-detail-block">
            <h3>Line items</h3>
            <div className="kit-fin-table-wrap">
              <table className="kit-fin-table kit-fin-table--compact">
                <thead>
                  <tr>
                    <th>Kit</th>
                    <th>Color</th>
                    <th>Size</th>
                    <th className="kit-fin-num">Qty</th>
                    <th className="kit-fin-num">Unit</th>
                    <th className="kit-fin-num">Line</th>
                  </tr>
                </thead>
                <tbody>
                  {order.lines.map((l, i) => (
                    <tr key={`${order.id}-line-${i}`}>
                      <td>{l.kitType}</td>
                      <td>{l.color}</td>
                      <td>{l.size}</td>
                      <td className="kit-fin-num">{l.quantity}</td>
                      <td className="kit-fin-num">{fmt(l.unitPrice)}</td>
                      <td className="kit-fin-num">{fmt(l.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="kit-fin-totals">
              <div>
                <span>Sum of lines</span>
                <strong>{fmt(linesSum)}</strong>
              </div>
              <div>
                <span>Stored order total</span>
                <strong>{fmt(order.totalAmount)}</strong>
              </div>
              {Math.abs(linesSum - order.totalAmount) > 0.01 ? (
                <p className="kit-fin-warn-text">Line totals and order total differ — investigate this order.</p>
              ) : null}
            </div>
          </section>

          <section className="kit-fin-detail-block">
            <h3>Payment history</h3>
            {history.length === 0 ? (
              <p className="kit-fin-muted">No payment records yet.</p>
            ) : (
              <ul className="kit-fin-pay-list">
                {history.map((h) => (
                  <li key={h.id}>
                    <div>
                      <strong>{fmt(h.amount)}</strong>
                      <span className="kit-fin-muted"> · {formatShortDate(h.recordedAt)}</span>
                    </div>
                    <div className="kit-fin-muted">
                      {h.note ?? "—"}
                      {h.recordedBy ? ` · ${h.recordedBy}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="kit-fin-modal-foot">
            <Link href="/admin/kit-orders" className="kit-fin-link">
              Open in kit orders queue →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
