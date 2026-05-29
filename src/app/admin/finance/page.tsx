"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { adminApiFetch, readAdminApiError } from "@/lib/admin-api-fetch";
import type { AdminOverviewRefreshDetail } from "@/lib/admin-client-events";
import { useAdminOverviewRefresh } from "@/lib/use-admin-overview-refresh";
import { FinanceMetricCard } from "@/components/admin/finance/finance-metric-card";
import { formatAcademyMoney, formatShortDate, paymentCategoryLabel } from "@/lib/finance-format";

type Metrics = {
  collectedRevenue: number;
  expectedRevenue: number;
  completionRate: number;
  statusCounts: { paid: number; pending: number; unpaid: number; overdue: number };
  outstandingAmount: number;
  overdueAmount: number;
  expensesRecorded: number;
  netCashPosition: number;
};

type RecentRow = {
  id: string;
  playerName: string;
  paymentFor: string;
  amount: number;
  currency: string;
  dueDate: string;
  uiStatus: string;
  uiStatusLabel: string;
  subscriptionValidUntil?: string | null;
};

type Monthly = { month: string; collected: number; expected: number; completionRate: number };

type Alerts = {
  overdueCount: number;
  overdueAmount: number;
  unpaidCount: number;
  pendingReviewCount: number;
};

function statusBadgeClass(st: string) {
  if (st === "paid") return "admin-badge admin-badge--success";
  if (st === "pending") return "admin-badge admin-badge--warn";
  if (st === "overdue" || st === "unpaid") return "admin-badge admin-badge--danger";
  return "admin-badge admin-badge--muted";
}

export default function FinanceOverviewPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [monthly, setMonthly] = useState<Monthly[]>([]);
  const [recent, setRecent] = useState<RecentRow[]>([]);
  const [alerts, setAlerts] = useState<Alerts | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async (detail?: AdminOverviewRefreshDetail) => {
    const silent = Boolean(detail?.silent);
    if (!silent) {
      setLoading(true);
      setErr("");
    }
    try {
      const r = await adminApiFetch("/api/admin/payments?metricsOnly=1");
      if (!r.ok) throw new Error(await readAdminApiError(r));
      const d = await r.json();
      setMetrics(d.metrics);
      setMonthly(d.monthly ?? []);
      setRecent(d.recentTransactions ?? []);
      setAlerts(d.alerts ?? null);
    } catch (e) {
      if (!silent) setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useAdminOverviewRefresh(load);

  const monthMax = Math.max(...monthly.map((m) => Math.max(m.collected, m.expected)), 1);
  const currency = "RWF";

  return (
    <section className="page-stack finance-page-stack">
      <header className="card finance-hero">
        <span className="k-pill">FINANCE</span>
        <h1 className="page-h1">Overview</h1>
        <p className="page-lead muted">
          Collected fees, open balances, and recent activity. Figures below reflect <strong>all invoices</strong> in the
          system unless you filter on other pages.
        </p>
        <div className="finance-hero__cta">
          <Link href="/admin/finance/transactions" className="btn">
            Open ledger
          </Link>
          <Link href="/admin/finance/approvals" className="btn btn-secondary">
            Pending approvals
          </Link>
          <Link href="/admin/finance/pricing" className="btn btn-secondary">
            Manage pricing
          </Link>
        </div>
      </header>

      {err ? <p className="form-message">{err}</p> : null}
      {loading ? <div className="finance-skeleton finance-skeleton--metrics" aria-busy /> : null}

      {!loading && metrics ? (
        <>
          {alerts && alerts.overdueCount > 0 ? (
            <div className="card finance-alert finance-alert--danger" role="status">
              <strong>{alerts.overdueCount} overdue invoice(s)</strong> —{" "}
              {formatAcademyMoney(alerts.overdueAmount, currency)} past due.{" "}
              <Link href="/admin/finance/transactions?status=overdue" className="ks-text-link">
                Review now
              </Link>
            </div>
          ) : null}

          <div className="finance-metric-grid">
            <FinanceMetricCard
              label="Total collected (paid)"
              value={formatAcademyMoney(metrics.collectedRevenue, currency)}
              hint="Sum of all invoices marked paid in the current dataset."
              tone="income"
            />
            <FinanceMetricCard
              label="Total invoiced (expected)"
              value={formatAcademyMoney(metrics.expectedRevenue, currency)}
              hint="All invoice amounts regardless of payment status."
              tone="neutral"
            />
            <FinanceMetricCard
              label="Outstanding balance"
              value={formatAcademyMoney(metrics.outstandingAmount, currency)}
              hint="Unpaid + pending + overdue invoice totals."
              tone="warn"
            />
            <FinanceMetricCard
              label="Expenses recorded"
              value={formatAcademyMoney(metrics.expensesRecorded, currency)}
              hint="No expense ledger in this module yet — value is always zero."
              tone="expense"
            />
            <FinanceMetricCard
              label="Net position (cash in − expenses)"
              value={formatAcademyMoney(metrics.netCashPosition - metrics.expensesRecorded, currency)}
              hint="Collected revenue minus recorded expenses."
              tone="income"
            />
            <FinanceMetricCard
              label="Collection rate"
              value={`${metrics.completionRate}%`}
              hint="Paid amount ÷ invoiced amount for the same scope."
              tone="neutral"
            />
          </div>

          <div className="card finance-panel">
            <div className="finance-panel__head">
              <h2 className="finance-panel__title">Monthly trend</h2>
              <p className="finance-panel__lead muted">
                Per calendar month of <strong>due date</strong>. Green bar = collected; outline = total invoiced.
              </p>
            </div>
            <div className="finance-chart-dual" role="img" aria-label="Monthly collected versus expected">
              {monthly.length === 0 ? (
                <p className="muted">No payment data yet.</p>
              ) : (
                monthly.map((m) => {
                  const hCollected = Math.max(4, (m.collected / monthMax) * 100);
                  const hExpected = Math.max(4, (m.expected / monthMax) * 100);
                  return (
                    <div key={m.month} className="finance-chart-dual__col">
                      <div className="finance-chart-dual__track">
                        <div
                          className="finance-chart-dual__bar finance-chart-dual__bar--expected"
                          style={{ height: `${hExpected}%` }}
                          title={`Invoiced ${formatAcademyMoney(m.expected, currency)}`}
                        />
                        <div
                          className="finance-chart-dual__bar finance-chart-dual__bar--collected"
                          style={{ height: `${hCollected}%` }}
                          title={`Collected ${formatAcademyMoney(m.collected, currency)}`}
                        />
                      </div>
                      <div className="finance-chart-dual__label">{m.month.slice(5)}</div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="finance-chart-legend">
              <span>
                <span className="finance-dot finance-dot--collected" /> Collected
              </span>
              <span>
                <span className="finance-dot finance-dot--expected" /> Invoiced
              </span>
            </div>
          </div>

          <div className="card finance-panel">
            <div className="finance-panel__head">
              <h2 className="finance-panel__title">Recent activity</h2>
              <Link href="/admin/finance/transactions" className="ks-text-link">
                Open ledger →
              </Link>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table finance-table">
                <thead>
                  <tr>
                    <th>Due</th>
                    <th>Player</th>
                    <th>Description</th>
                    <th>Subscription ends</th>
                    <th>Category</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((row) => (
                    <tr key={row.id}>
                      <td>{formatShortDate(row.dueDate)}</td>
                      <td>{row.playerName}</td>
                      <td>{row.paymentFor}</td>
                      <td>{row.subscriptionValidUntil ? formatShortDate(row.subscriptionValidUntil) : "—"}</td>
                      <td>
                        <span className="finance-pill">{paymentCategoryLabel(row.paymentFor)}</span>
                      </td>
                      <td className="finance-num">{formatAcademyMoney(row.amount, row.currency)}</td>
                      <td>
                        <span className={statusBadgeClass(row.uiStatus)}>{row.uiStatusLabel}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="finance-status-strip card">
            <div>
              <span className="finance-status-strip__n">{metrics.statusCounts.paid}</span>
              <span className="muted">Paid</span>
            </div>
            <div>
              <span className="finance-status-strip__n">{metrics.statusCounts.pending}</span>
              <span className="muted">Pending review</span>
            </div>
            <div>
              <span className="finance-status-strip__n">{metrics.statusCounts.unpaid}</span>
              <span className="muted">Unpaid</span>
            </div>
            <div>
              <span className="finance-status-strip__n">{metrics.statusCounts.overdue}</span>
              <span className="muted">Overdue</span>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
