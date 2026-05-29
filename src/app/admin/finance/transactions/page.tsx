"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ADMIN_OVERVIEW_REFRESH } from "@/lib/admin-client-events";
import { adminApiFetch, readAdminApiError } from "@/lib/admin-api-fetch";
import type { AdminOverviewRefreshDetail } from "@/lib/admin-client-events";
import { useAdminOverviewRefresh } from "@/lib/use-admin-overview-refresh";
import { AGE_GROUPS } from "@/lib/age-groups";
import { formatAcademyMoney, formatShortDate, paymentCategoryLabel } from "@/lib/finance-format";
import { buildAdminPaymentRowModel } from "@/lib/admin-payment-ui";
import { MEMBERSHIP_EXPIRING_SOON_DAYS } from "@/lib/membership-billing";
import type { SubscriptionUiStatus } from "@/lib/types";

type Pay = {
  id: string;
  playerId: string;
  playerName: string;
  parentName: string;
  parentEmail: string;
  ageGroup: string;
  amount: number;
  currency: string;
  paymentFor: string;
  dueDate: string;
  paidAt?: string;
  uiStatus: "paid" | "pending" | "unpaid" | "overdue";
  uiStatusLabel: string;
  paymentMethod?: string;
  mobileMoneyRef?: string;
  paymentNotes?: string;
  proofUrl?: string;
  verifiedBy?: string;
  invoiceSentAt?: string;
  subscriptionValidUntil?: string | null;
  subscriptionUiStatus?: SubscriptionUiStatus;
};

type Metrics = {
  collectedRevenue: number;
  expectedRevenue: number;
  completionRate: number;
  statusCounts: { paid: number; pending: number; unpaid: number; overdue: number };
  outstandingAmount: number;
  overdueAmount: number;
};

function exportHref(
  format: "csv" | "xlsx" | "html",
  p: {
    status: string;
    month: string;
    group: string;
    q: string;
    dateFrom: string;
    dateTo: string;
    type: string;
    playerId: string;
    subStatus: string;
  }
) {
  const qs = new URLSearchParams();
  qs.set("dataset", "payments");
  qs.set("format", format);
  if (p.status) qs.set("status", p.status);
  if (p.month) qs.set("month", p.month);
  if (p.group) qs.set("group", p.group);
  if (p.q) qs.set("q", p.q);
  if (p.dateFrom) qs.set("dateFrom", p.dateFrom);
  if (p.dateTo) qs.set("dateTo", p.dateTo);
  if (p.type) qs.set("type", p.type);
  if (p.playerId) qs.set("playerId", p.playerId);
  if (p.subStatus) qs.set("subStatus", p.subStatus);
  return `/api/admin/export?${qs}`;
}

function TransactionsInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialStatus = (searchParams.get("status") as "" | Pay["uiStatus"]) || "";

  const [rows, setRows] = useState<Pay[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [pagination, setPagination] = useState<{ page: number; pageSize: number; total: number; totalPages: number } | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Pay | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const [status, setStatus] = useState<"" | Pay["uiStatus"]>(initialStatus);
  const [month, setMonth] = useState("");
  const [group, setGroup] = useState("");
  const [type, setType] = useState<"" | "registration" | "membership" | "other">("");
  const [subStatus, setSubStatus] = useState<"" | SubscriptionUiStatus>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [sortBy, setSortBy] = useState<"dueDate" | "amount" | "playerName" | "paymentFor" | "status">("dueDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [filterPlayerId, setFilterPlayerId] = useState("");

  useEffect(() => {
    setFilterPlayerId(searchParams.get("playerId")?.trim() ?? "");
  }, [searchParams]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 320);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(
    async (detail?: AdminOverviewRefreshDetail) => {
      const quiet = Boolean(detail?.silent);
      if (!quiet) setLoading(true);
      setErr("");
      try {
        const qs = new URLSearchParams();
        if (status) qs.set("status", status);
        if (month) qs.set("month", month);
        if (group) qs.set("group", group);
        if (type) qs.set("type", type);
        if (subStatus) qs.set("subStatus", subStatus);
        if (dateFrom) qs.set("dateFrom", dateFrom);
        if (dateTo) qs.set("dateTo", dateTo);
        if (debouncedQ) qs.set("q", debouncedQ);
        if (filterPlayerId) qs.set("playerId", filterPlayerId);
        qs.set("sortBy", sortBy);
        qs.set("sortDir", sortDir);
        qs.set("page", String(page));
        qs.set("pageSize", String(pageSize));
        const r = await adminApiFetch(`/api/admin/payments?${qs}`);
        if (!r.ok) throw new Error(await readAdminApiError(r));
        const data = await r.json();
        setRows(data.payments);
        setMetrics(data.metrics);
        setPagination(data.pagination ?? null);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed");
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [status, month, group, type, subStatus, dateFrom, dateTo, debouncedQ, sortBy, sortDir, page, filterPlayerId]
  );

  useEffect(() => {
    load();
  }, [load]);

  useAdminOverviewRefresh(load);

  useEffect(() => {
    setPage(1);
  }, [status, month, group, type, subStatus, dateFrom, dateTo, debouncedQ, sortBy, sortDir, filterPlayerId]);

  useEffect(() => {
    if (!selected) return;
    const onK = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onK);
    return () => window.removeEventListener("keydown", onK);
  }, [selected]);

  const exportParams = useMemo(
    () => ({ status, month, group, q: debouncedQ, dateFrom, dateTo, type, playerId: filterPlayerId, subStatus }),
    [status, month, group, debouncedQ, dateFrom, dateTo, type, filterPlayerId, subStatus]
  );

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (status) n += 1;
    if (month) n += 1;
    if (group) n += 1;
    if (type) n += 1;
    if (subStatus) n += 1;
    if (dateFrom) n += 1;
    if (dateTo) n += 1;
    if (debouncedQ) n += 1;
    if (filterPlayerId) n += 1;
    return n;
  }, [status, month, group, type, subStatus, dateFrom, dateTo, debouncedQ, filterPlayerId]);

  function resetFilters() {
    setStatus("");
    setMonth("");
    setGroup("");
    setType("");
    setSubStatus("");
    setDateFrom("");
    setDateTo("");
    setQ("");
    setFilterPlayerId("");
    setSortBy("dueDate");
    setSortDir("desc");
    setPage(1);
    setExpandedIds(new Set());
    router.replace("/admin/finance/transactions");
  }

  function toggleExpanded(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function act(id: string, action: "confirm" | "mark_pending" | "mark_overdue" | "send_invoice") {
    setBusyId(id);
    setNotice("");
    try {
      const r = await adminApiFetch(`/api/admin/payments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      if (!r.ok) throw new Error(await readAdminApiError(r));
      setNotice(
        action === "confirm"
          ? "Payment approved successfully."
          : action === "send_invoice"
            ? "Reminder sent. Email delivers when mail is configured."
            : "Updated."
      );
      window.dispatchEvent(new Event(ADMIN_OVERVIEW_REFRESH));
      if (action === "confirm") {
        setSelected((s) => (s?.id === id ? null : s));
      }
      await load({ silent: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  function toggleSort(next: typeof sortBy) {
    if (sortBy === next) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(next);
      setSortDir(next === "dueDate" || next === "amount" ? "desc" : "asc");
    }
  }

  const sortHint = (key: typeof sortBy) => (sortBy === key ? (sortDir === "asc" ? " ↑" : " ↓") : "");

  const selectedModel = selected
    ? buildAdminPaymentRowModel({ uiStatus: selected.uiStatus, subscriptionUiStatus: selected.subscriptionUiStatus })
    : null;

  return (
    <>
      <section className="page-stack finance-page-stack ledger-page">
        <header className="card finance-hero ledger-hero">
          <div className="ledger-hero__top">
            <div>
              <span className="k-pill">FINANCE</span>
              <h1 className="page-h1">Ledger</h1>
              <p className="page-lead muted">
                Full-width invoice register. Row colors reflect payment status; monthly membership uses blue (current),
                amber (ends within {MEMBERSHIP_EXPIRING_SOON_DAYS} days), red (ended or urgent invoice). Click a row
                for details — use <strong>Details</strong> or the row body.
              </p>
            </div>
            <div className="ledger-hero__legend" aria-hidden>
              <span className="ledger-legend-item">
                <span className="ledger-legend-swatch ledger-legend-swatch--blue" /> Monthly membership current
              </span>
              <span className="ledger-legend-item">
                <span className="ledger-legend-swatch ledger-legend-swatch--amber" /> Ends within{" "}
                {MEMBERSHIP_EXPIRING_SOON_DAYS} days
              </span>
              <span className="ledger-legend-item">
                <span className="ledger-legend-swatch ledger-legend-swatch--red" /> Monthly period ended / urgent
                invoice
              </span>
            </div>
          </div>
        </header>

        {metrics ? (
          <div className="ledger-summary card">
            <div className="ledger-summary__grid">
              <div className="ledger-summary__item ledger-summary__item--success">
                <span className="ledger-summary__label">Collected (filtered)</span>
                <strong className="ledger-summary__value">{formatAcademyMoney(metrics.collectedRevenue, "RWF")}</strong>
                <span className="ledger-summary__hint">{metrics.statusCounts.paid} paid invoices</span>
              </div>
              <div className="ledger-summary__item">
                <span className="ledger-summary__label">Invoiced</span>
                <strong className="ledger-summary__value">{formatAcademyMoney(metrics.expectedRevenue, "RWF")}</strong>
                <span className="ledger-summary__hint">{metrics.completionRate}% collected</span>
              </div>
              <div className="ledger-summary__item ledger-summary__item--warn">
                <span className="ledger-summary__label">Outstanding</span>
                <strong className="ledger-summary__value">{formatAcademyMoney(metrics.outstandingAmount, "RWF")}</strong>
                <span className="ledger-summary__hint">
                  {metrics.statusCounts.unpaid} unpaid · {metrics.statusCounts.pending} pending
                </span>
              </div>
              <div className="ledger-summary__item ledger-summary__item--danger">
                <span className="ledger-summary__label">Overdue</span>
                <strong className="ledger-summary__value">{formatAcademyMoney(metrics.overdueAmount, "RWF")}</strong>
                <span className="ledger-summary__hint">{metrics.statusCounts.overdue} invoices</span>
              </div>
            </div>
          </div>
        ) : null}

        <div className="card finance-filters-card ledger-filters">
          <div className="finance-filters-card__head">
            <h2 className="finance-panel__title">Filters &amp; search</h2>
            {activeFilterCount > 0 ? (
              <span className="finance-active-filters">{activeFilterCount} active</span>
            ) : (
              <span className="muted">No filters</span>
            )}
            <button type="button" className="btn btn-secondary finance-btn-sm" onClick={resetFilters}>
              Reset all
            </button>
          </div>
          <div className="finance-filter-grid">
            <label className="form-label">
              <span>Invoice status</span>
              <select className="input-field" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                <option value="">All</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending review</option>
                <option value="unpaid">Unpaid</option>
                <option value="overdue">Overdue</option>
              </select>
            </label>
            <label className="form-label">
              <span>Membership (subscription)</span>
              <select
                className="input-field"
                value={subStatus}
                onChange={(e) => setSubStatus(e.target.value as typeof subStatus)}
              >
                <option value="">All players</option>
                <option value="active">Active</option>
                <option value="expiring_soon">Expiring within 7 days</option>
                <option value="expired">Expired</option>
                <option value="ended">No end date on file</option>
              </select>
            </label>
            <label className="form-label">
              <span>Invoice type</span>
              <select className="input-field" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
                <option value="">All</option>
                <option value="registration">Registration</option>
                <option value="membership">Membership</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="form-label">
              <span>Due month</span>
              <input className="input-field" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </label>
            <label className="form-label">
              <span>Age group</span>
              <select className="input-field" value={group} onChange={(e) => setGroup(e.target.value)}>
                <option value="">All</option>
                {AGE_GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-label">
              <span>Due from</span>
              <input className="input-field" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </label>
            <label className="form-label">
              <span>Due to</span>
              <input className="input-field" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </label>
            <label className="form-label finance-filter-span-2">
              <span>Search player, parent, email, invoice line, subscription date</span>
              <input
                className="input-field"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search…"
                aria-busy={loading}
              />
            </label>
          </div>
          <div className="finance-export-row">
            <span className="muted">Export matches filters:</span>
            <a className="btn btn-secondary finance-btn-sm" href={exportHref("csv", exportParams)}>
              CSV
            </a>
            <a className="btn btn-secondary finance-btn-sm" href={exportHref("html", exportParams)}>
              HTML
            </a>
          </div>
        </div>

        {filterPlayerId ? (
          <div className="card finance-panel finance-panel--muted">
            <p className="finance-help" style={{ margin: 0 }}>
              Showing one player only.{" "}
              <button
                type="button"
                className="ks-text-link"
                style={{ background: "none", border: 0, padding: 0, cursor: "pointer", font: "inherit" }}
                onClick={() => {
                  const sp = new URLSearchParams(searchParams.toString());
                  sp.delete("playerId");
                  const path = sp.toString() ? `/admin/finance/transactions?${sp.toString()}` : "/admin/finance/transactions";
                  router.replace(path);
                }}
              >
                Clear player filter
              </button>
            </p>
          </div>
        ) : null}

        {notice ? <p className="finance-toast finance-toast--ok">{notice}</p> : null}
        {err ? <p className="form-message">{err}</p> : null}

        <div className="card finance-panel ledger-panel">
          <div className="finance-panel__head">
            <h2 className="finance-panel__title">Invoices</h2>
            {pagination ? (
              <p className="muted finance-panel__meta">
                {(pagination.page - 1) * pagination.pageSize + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)}{" "}
                of {pagination.total}
              </p>
            ) : null}
          </div>
          {loading ? <div className="finance-skeleton finance-skeleton--table" aria-busy /> : null}
          {!loading ? (
            <div className="ledger-table-scroll">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th className="ledger-th ledger-th--narrow" aria-label="Expand details" />
                    <th className="ledger-th">
                      <button type="button" className="ledger-th-btn" onClick={() => toggleSort("dueDate")}>
                        Due{sortHint("dueDate")}
                      </button>
                    </th>
                    <th className="ledger-th">
                      <button type="button" className="ledger-th-btn" onClick={() => toggleSort("playerName")}>
                        Player{sortHint("playerName")}
                      </button>
                    </th>
                    <th className="ledger-th">
                      <button type="button" className="ledger-th-btn" onClick={() => toggleSort("paymentFor")}>
                        Invoice{sortHint("paymentFor")}
                      </button>
                    </th>
                    <th className="ledger-th ledger-th--num">
                      <button type="button" className="ledger-th-btn" onClick={() => toggleSort("amount")}>
                        Amount{sortHint("amount")}
                      </button>
                    </th>
                    <th className="ledger-th">
                      <button type="button" className="ledger-th-btn" onClick={() => toggleSort("status")}>
                        Payment{sortHint("status")}
                      </button>
                    </th>
                    <th className="ledger-th">Membership</th>
                    <th className="ledger-th ledger-th--actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p, rowIndex) => {
                    const expanded = expandedIds.has(p.id);
                    const model = buildAdminPaymentRowModel({
                      uiStatus: p.uiStatus,
                      subscriptionUiStatus: p.subscriptionUiStatus
                    });
                    const rowTone =
                      p.uiStatus === "overdue"
                        ? "ledger-row--tone-overdue"
                        : p.uiStatus === "unpaid"
                          ? "ledger-row--tone-unpaid"
                          : p.uiStatus === "pending"
                            ? "ledger-row--tone-pending"
                            : "";
                    const zebra = rowIndex % 2 === 1 ? "ledger-row--zebra" : "";
                    const rowClass = `ledger-row ${rowTone} ${zebra} ${model.rowHighlightClass}`.trim();
                    return (
                      <Fragment key={p.id}>
                        <tr
                          className={rowClass}
                          onClick={() => setSelected(p)}
                          title="Open payment details"
                        >
                          <td className="ledger-td ledger-td--toggle">
                            <button
                              type="button"
                              className="ledger-expand-btn"
                              aria-expanded={expanded}
                              aria-label={expanded ? "Collapse row details" : "Expand row details"}
                              onClick={(e) => toggleExpanded(p.id, e)}
                            >
                              {expanded ? "▼" : "▶"}
                            </button>
                          </td>
                          <td className="ledger-td ledger-td--date">
                            <time dateTime={p.dueDate}>{formatShortDate(p.dueDate)}</time>
                          </td>
                          <td className="ledger-td ledger-td--player">
                            <span className="ledger-player-name">{p.playerName}</span>
                            <span className="ledger-player-meta">{p.ageGroup}</span>
                          </td>
                          <td className="ledger-td ledger-td--for">
                            <span className="ledger-for-text" title={p.paymentFor}>
                              {p.paymentFor}
                            </span>
                            <span className="ledger-cat-pill">{paymentCategoryLabel(p.paymentFor)}</span>
                          </td>
                          <td className="ledger-td ledger-td--num">{formatAcademyMoney(p.amount, p.currency)}</td>
                          <td className="ledger-td">
                            <span className={model.paymentBadgeClass}>{model.paymentBadgeLabel}</span>
                          </td>
                          <td className="ledger-td ledger-td--sub">
                            <div className="admin-pay-badge-stack">
                              <span className={model.subscriptionBadgeClass}>{model.subscriptionBadgeLabel}</span>
                              <span className="ledger-sub-date">
                                {p.subscriptionValidUntil ? formatShortDate(p.subscriptionValidUntil) : "—"}
                              </span>
                            </div>
                          </td>
                          <td className="ledger-td ledger-td--actions" onClick={(e) => e.stopPropagation()}>
                            <div className="ledger-actions">
                              <button
                                type="button"
                                className="btn btn-secondary ledger-action-btn"
                                onClick={() => setSelected(p)}
                              >
                                View details
                              </button>
                              {model.canApprovePayment ? (
                                <>
                                  <button
                                    type="button"
                                    className="btn ledger-action-btn"
                                    disabled={busyId === p.id}
                                    title={model.approveTooltip}
                                    onClick={() => void act(p.id, "confirm")}
                                  >
                                    Approve payment
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-secondary ledger-action-btn"
                                    disabled={busyId === p.id}
                                    title={model.reminderTooltip}
                                    onClick={() => void act(p.id, "send_invoice")}
                                  >
                                    Send reminder
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                        {expanded ? (
                          <tr key={`${p.id}-ex`} className="ledger-row-expanded">
                            <td colSpan={8}>
                              <div className="ledger-expanded-inner">
                                <div>
                                  <span className="ledger-expanded-k">Parent</span>
                                  <span className="ledger-expanded-v">
                                    {p.parentName}
                                    <span className="muted"> · {p.parentEmail}</span>
                                  </span>
                                </div>
                                <div>
                                  <span className="ledger-expanded-k">Paid on</span>
                                  <span className="ledger-expanded-v">{p.paidAt ? formatShortDate(p.paidAt) : "—"}</span>
                                </div>
                                <div>
                                  <span className="ledger-expanded-k">Profile</span>
                                  <span className="ledger-expanded-v">
                                    <Link href={`/admin/players/${p.playerId}`} className="ks-text-link">
                                      Open player
                                    </Link>
                                  </span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
          {pagination && pagination.totalPages > 1 ? (
            <div className="finance-pagination">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={page <= 1}
                onClick={() => setPage((x) => Math.max(1, x - 1))}
              >
                Previous
              </button>
              <span className="muted">
                Page {pagination.page} / {pagination.totalPages}
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((x) => x + 1)}
              >
                Next
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {selected ? (
        <div className="finance-modal-backdrop" role="presentation" onClick={() => setSelected(null)}>
          <div
            className="finance-modal card ledger-modal"
            role="dialog"
            aria-modal
            aria-labelledby="finance-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="finance-modal__head">
              <h2 id="finance-modal-title">Payment details</h2>
              <button type="button" className="finance-modal__close" onClick={() => setSelected(null)} aria-label="Close">
                ×
              </button>
            </div>
            <dl className="finance-dl">
              <div>
                <dt>Invoice</dt>
                <dd>{selected.paymentFor}</dd>
              </div>
              <div>
                <dt>Amount</dt>
                <dd className="finance-num finance-num--lg">{formatAcademyMoney(selected.amount, selected.currency)}</dd>
              </div>
              <div>
                <dt>Payment status</dt>
                <dd>
                  {selectedModel ? (
                    <span className={selectedModel.paymentBadgeClass}>{selectedModel.paymentBadgeLabel}</span>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt>Membership</dt>
                <dd>
                  {selectedModel ? (
                    <>
                      <span className={selectedModel.subscriptionBadgeClass}>{selectedModel.subscriptionBadgeLabel}</span>
                      {selected.subscriptionValidUntil ? (
                        <span className="muted" style={{ marginLeft: "0.5rem" }}>
                          until {formatShortDate(selected.subscriptionValidUntil)}
                        </span>
                      ) : null}
                    </>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt>Due date</dt>
                <dd>{formatShortDate(selected.dueDate)}</dd>
              </div>
              <div>
                <dt>Paid at</dt>
                <dd>{selected.paidAt ? formatShortDate(selected.paidAt) : "—"}</dd>
              </div>
              <div>
                <dt>Player</dt>
                <dd>
                  {selected.playerName}{" "}
                  <Link href={`/admin/players/${selected.playerId}`} className="ks-text-link">
                    Open profile
                  </Link>
                </dd>
              </div>
              <div>
                <dt>Parent</dt>
                <dd>
                  {selected.parentName} · {selected.parentEmail}
                </dd>
              </div>
              <div>
                <dt>Method / ref</dt>
                <dd>
                  {selected.paymentMethod ?? "—"}
                  {selected.mobileMoneyRef ? ` · ${selected.mobileMoneyRef}` : ""}
                </dd>
              </div>
              <div>
                <dt>Notes</dt>
                <dd>{selected.paymentNotes ?? "—"}</dd>
              </div>
            </dl>
            <div className="finance-modal__actions">
              {selectedModel?.canApprovePayment ? (
                <>
                  <button
                    type="button"
                    className="btn"
                    disabled={busyId === selected.id}
                    title={selectedModel.approveTooltip}
                    onClick={() => {
                      void act(selected.id, "confirm");
                    }}
                  >
                    Approve payment
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busyId === selected.id}
                    title={selectedModel.reminderTooltip}
                    onClick={() => {
                      void act(selected.id, "send_invoice");
                    }}
                  >
                    Send reminder
                  </button>
                </>
              ) : null}
              <button type="button" className="btn btn-secondary" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default function FinanceTransactionsPage() {
  return (
    <Suspense fallback={<div className="finance-skeleton finance-skeleton--page" aria-busy />}>
      <TransactionsInner />
    </Suspense>
  );
}
