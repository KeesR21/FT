"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { adminApiFetch } from "@/lib/admin-api-fetch";
import { useAdminOverviewRefresh } from "@/lib/use-admin-overview-refresh";
import { ADMIN_OVERVIEW_REFRESH } from "@/lib/admin-client-events";
import { formatAcademyMoney, formatShortDate, paymentCategoryLabel } from "@/lib/finance-format";
import { buildAdminPaymentRowModel } from "@/lib/admin-payment-ui";
import type { SubscriptionUiStatus } from "@/lib/types";

type Row = {
  id: string;
  playerId: string;
  playerName: string;
  parentName: string;
  parentEmail: string;
  ageGroup: string;
  paymentFor: string;
  amount: number;
  currency: string;
  dueDate: string;
  uiStatus: "paid" | "pending" | "unpaid" | "overdue";
  uiStatusLabel: string;
  subscriptionValidUntil?: string | null;
  subscriptionUiStatus?: SubscriptionUiStatus;
};

type ApprovalsTab = "all" | "unpaid" | "pending" | "overdue" | "expired_sub";

export default function FinanceApprovalsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<ApprovalsTab>("all");

  const load = useCallback(async (opts?: { quiet?: boolean }) => {
    const quiet = Boolean(opts?.quiet);
    if (!quiet) setLoading(true);
    setErr("");
    try {
      const r = await adminApiFetch("/api/admin/payments?pageSize=0");
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      const open = (data.payments ?? []).filter(
        (p: Row) => p.uiStatus === "unpaid" || p.uiStatus === "pending" || p.uiStatus === "overdue"
      );
      setRows(open);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useAdminOverviewRefresh(load);

  const filtered = useMemo(() => {
    if (tab === "all") return rows;
    if (tab === "expired_sub") return rows.filter((r) => r.subscriptionUiStatus === "expired");
    return rows.filter((r) => r.uiStatus === tab);
  }, [rows, tab]);

  const counts = useMemo(() => {
    const c = { all: rows.length, unpaid: 0, pending: 0, overdue: 0, expired_sub: 0 };
    for (const r of rows) {
      if (r.uiStatus === "unpaid") c.unpaid += 1;
      if (r.uiStatus === "pending") c.pending += 1;
      if (r.uiStatus === "overdue") c.overdue += 1;
      if (r.subscriptionUiStatus === "expired") c.expired_sub += 1;
    }
    return c;
  }, [rows]);

  async function patchPayment(id: string, action: "confirm" | "send_invoice") {
    setBusyId(id);
    setNotice("");
    try {
      const r = await adminApiFetch(`/api/admin/payments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      if (!r.ok) throw new Error(await r.text());
      if (action === "confirm") {
        setNotice("Payment approved successfully.");
      } else {
        setNotice("Reminder sent. Email delivers when mail is configured.");
      }
      window.dispatchEvent(new Event(ADMIN_OVERVIEW_REFRESH));
      await load({ quiet: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="page-stack finance-page-stack">
      <header className="card finance-hero">
        <span className="k-pill">FINANCE</span>
        <h1 className="page-h1">Approvals</h1>
        <p className="page-lead muted">
          Open invoices that still need confirmation. Approving records cash received and may trigger parent emails and
          roster updates (e.g. registration fee). Expired memberships stay in this queue until payment is approved.
        </p>
        <Link href="/admin/finance/transactions" className="ks-text-link">
          ← Full ledger
        </Link>
      </header>

      <div className="card finance-filters-card">
        <div className="admin-applications-tabs" role="tablist">
          {(
            [
              ["all", "All open"],
              ["unpaid", "Unpaid"],
              ["pending", "Pending review"],
              ["overdue", "Overdue"],
              ["expired_sub", "Expired membership"]
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={`admin-applications-tab${tab === key ? " admin-applications-tab--active" : ""}`}
              onClick={() => setTab(key)}
            >
              {label}
              {key === "all" ? ` (${counts.all})` : ` (${counts[key]})`}
            </button>
          ))}
        </div>
      </div>

      {notice ? <p className="finance-toast finance-toast--ok">{notice}</p> : null}
      {err ? <p className="form-message">{err}</p> : null}
      {loading ? <div className="finance-skeleton finance-skeleton--table" aria-busy /> : null}

      {!loading && filtered.length === 0 ? <p className="muted card">Nothing waiting in this queue.</p> : null}

      {!loading && filtered.length > 0 ? (
        <div className="card finance-panel">
          <div className="admin-table-wrap">
            <table className="admin-table finance-table">
              <thead>
                <tr>
                  <th>Due</th>
                  <th>Player</th>
                  <th>Parent</th>
                  <th>Invoice</th>
                  <th>Subscription ends</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const model = buildAdminPaymentRowModel({
                    uiStatus: row.uiStatus,
                    subscriptionUiStatus: row.subscriptionUiStatus
                  });
                  const trClass = [model.rowHighlightClass].filter(Boolean).join(" ");
                  return (
                    <tr key={row.id} className={trClass || undefined}>
                      <td>{formatShortDate(row.dueDate)}</td>
                      <td>
                        <Link href={`/admin/players/${row.playerId}`} className="ks-text-link">
                          {row.playerName}
                        </Link>
                        <div className="muted admin-cell-muted">{row.ageGroup}</div>
                      </td>
                      <td>
                        {row.parentName}
                        <br />
                        <span className="muted admin-cell-muted">{row.parentEmail}</span>
                      </td>
                      <td>{row.paymentFor}</td>
                      <td>{row.subscriptionValidUntil ? formatShortDate(row.subscriptionValidUntil) : "—"}</td>
                      <td>
                        <span className="finance-pill">{paymentCategoryLabel(row.paymentFor)}</span>
                      </td>
                      <td className="finance-num">{formatAcademyMoney(row.amount, row.currency)}</td>
                      <td>
                        <div className="admin-pay-badge-stack">
                          <span className={model.paymentBadgeClass}>{model.paymentBadgeLabel}</span>
                          <span className={model.subscriptionBadgeClass}>{model.subscriptionBadgeLabel}</span>
                        </div>
                      </td>
                      <td>
                        {model.canApprovePayment ? (
                          <div className="approvals-actions-stack">
                            <button
                              type="button"
                              className="btn admin-btn-sm"
                              disabled={busyId === row.id}
                              title={model.approveTooltip}
                              onClick={() => void patchPayment(row.id, "confirm")}
                            >
                              Approve payment
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary admin-btn-sm"
                              disabled={busyId === row.id}
                              title={model.reminderTooltip}
                              onClick={() => void patchPayment(row.id, "send_invoice")}
                            >
                              Send reminder
                            </button>
                          </div>
                        ) : (
                          <span className="approvals-paid-hint">Paid — no action</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
