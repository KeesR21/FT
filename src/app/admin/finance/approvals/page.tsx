"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { adminApiFetch, readAdminApiError } from "@/lib/admin-api-fetch";
import { useAdminOverviewRefresh } from "@/lib/use-admin-overview-refresh";
import { ADMIN_OVERVIEW_REFRESH, type AdminOverviewRefreshDetail } from "@/lib/admin-client-events";
import { formatAcademyMoney, formatShortDate, paymentCategoryLabel } from "@/lib/finance-format";
import { buildAdminPaymentRowModel } from "@/lib/admin-payment-ui";
import { SystemNotice } from "@/components/system/system-notice";
import type { SubscriptionUiStatus } from "@/lib/types";

type Row = {
  id: string;
  playerId: string;
  playerName: string;
  parentName: string;
  parentEmail: string;
  ageGroup: string;
  paymentFor: string;
  paymentCategory: "registration" | "membership" | "other";
  amount: number;
  currency: string;
  dueDate: string;
  uiStatus: "paid" | "pending" | "unpaid" | "overdue";
  uiStatusLabel: string;
  subscriptionValidUntil?: string | null;
  subscriptionUiStatus?: SubscriptionUiStatus;
  projectedSubscriptionStartsAt?: string | null;
  projectedSubscriptionEndsAt?: string | null;
  playerDanger?: boolean;
  playerOverdueDays?: number;
};

type ApprovalsTab = "all" | "application" | "monthly" | "unpaid" | "pending" | "overdue" | "danger";

function paymentTypeLabel(category: Row["paymentCategory"]): string {
  if (category === "registration") return "Application Fee";
  if (category === "membership") return "Monthly Membership";
  return "Other";
}

function paymentTypeBadgeClass(category: Row["paymentCategory"]): string {
  if (category === "registration") return "app-pay-type-pill app-pay-type-pill--application";
  if (category === "membership") return "app-pay-type-pill app-pay-type-pill--monthly";
  return "app-pay-type-pill app-pay-type-pill--other";
}

function monthYearLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function FinanceApprovalsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<ApprovalsTab>("all");
  const inFlightRef = useRef<Set<string>>(new Set());

  const load = useCallback(async (detail?: AdminOverviewRefreshDetail) => {
    const quiet = Boolean(detail?.silent);
    if (!quiet) setLoading(true);
    setErr("");
    try {
      const r = await adminApiFetch("/api/admin/payments?pageSize=0");
      if (!r.ok) throw new Error(await readAdminApiError(r));
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
    if (tab === "application") return rows.filter((r) => r.paymentCategory === "registration");
    if (tab === "monthly") return rows.filter((r) => r.paymentCategory === "membership");
    if (tab === "danger") return rows.filter((r) => r.playerDanger);
    return rows.filter((r) => r.uiStatus === tab);
  }, [rows, tab]);

  const counts = useMemo(() => {
    const c = {
      all: rows.length,
      application: 0,
      monthly: 0,
      unpaid: 0,
      pending: 0,
      overdue: 0,
      danger: 0
    };
    for (const r of rows) {
      if (r.paymentCategory === "registration") c.application += 1;
      if (r.paymentCategory === "membership") c.monthly += 1;
      if (r.uiStatus === "unpaid") c.unpaid += 1;
      if (r.uiStatus === "pending") c.pending += 1;
      if (r.uiStatus === "overdue") c.overdue += 1;
      if (r.playerDanger) c.danger += 1;
    }
    return c;
  }, [rows]);

  async function patchPayment(id: string, action: "confirm" | "send_invoice" | "void") {
    if (inFlightRef.current.has(id)) return;
    let voidReason: string | undefined;
    if (action === "void") {
      const reason = window.prompt(
        "Reason for voiding this invoice (3+ characters). Voiding releases the player so a new monthly invoice can be issued."
      );
      if (!reason || reason.trim().length < 3) {
        setErr("Void cancelled — a reason of at least 3 characters is required.");
        return;
      }
      voidReason = reason.trim();
    }
    inFlightRef.current.add(id);
    setBusyId(id);
    setNotice("");
    setErr("");
    try {
      const r = await adminApiFetch(`/api/admin/payments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(voidReason ? { action, voidReason } : { action })
      });
      if (!r.ok) throw new Error(await readAdminApiError(r));
      const json = await r.json();
      const baseMessage =
        json && typeof json.message === "string" && json.message
          ? json.message
          : action === "confirm"
            ? "Payment approved successfully."
            : action === "void"
              ? "Invoice voided."
              : "Reminder sent.";
      setNotice(baseMessage);
      window.dispatchEvent(new Event(ADMIN_OVERVIEW_REFRESH));
      await load({ silent: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      inFlightRef.current.delete(id);
      setBusyId(null);
    }
  }

  return (
    <section className="page-stack finance-page-stack">
      <header className="card finance-hero">
        <span className="k-pill">FINANCE</span>
        <h1 className="page-h1">Pending Approvals</h1>
        <p className="page-lead muted">
          Open invoices that still need confirmation. Application fees and monthly membership fees are listed
          separately so the next action is unambiguous. Approving a registration fee marks it paid only — admit
          the player from <Link href="/admin/applications" className="ks-text-link">Applications</Link> to start
          the monthly membership.
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
              ["application", "Application Fee"],
              ["monthly", "Monthly Membership"],
              ["unpaid", "Unpaid"],
              ["pending", "Pending review"],
              ["overdue", "Overdue"],
              ["danger", "Danger (>5d late)"]
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
              {` (${counts[key]})`}
            </button>
          ))}
        </div>
      </div>

      {notice ? (
        <SystemNotice variant="success" title="Done">
          {notice}
        </SystemNotice>
      ) : null}
      {err ? (
        <SystemNotice variant="error" title="Action failed">
          {err}
        </SystemNotice>
      ) : null}
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
                  <th>Type</th>
                  <th>Subscription month</th>
                  <th>Start</th>
                  <th>End</th>
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
                  const startsAt =
                    row.paymentCategory === "membership"
                      ? row.projectedSubscriptionStartsAt ?? row.dueDate
                      : null;
                  const endsAt =
                    row.paymentCategory === "membership"
                      ? row.projectedSubscriptionEndsAt ?? row.subscriptionValidUntil ?? null
                      : null;
                  const monthLabel =
                    row.paymentCategory === "membership"
                      ? monthYearLabel(startsAt ?? row.dueDate)
                      : "—";
                  const trClasses = [model.rowHighlightClass, row.playerDanger ? "admin-pay-row--danger" : ""]
                    .filter(Boolean)
                    .join(" ");
                  const isBusy = busyId === row.id;
                  return (
                    <tr key={row.id} className={trClasses || undefined}>
                      <td>{formatShortDate(row.dueDate)}</td>
                      <td>
                        <div className="admin-table-cell-player">
                          <Link href={`/admin/players/${row.playerId}`} className="ks-text-link">
                            {row.playerName}
                          </Link>
                          {row.playerDanger ? (
                            <span
                              className="admin-danger-flag"
                              title={`Subscription ended ${row.playerOverdueDays ?? 0} days ago`}
                            >
                              DANGER
                            </span>
                          ) : null}
                        </div>
                        <div className="muted admin-cell-muted">{row.ageGroup}</div>
                      </td>
                      <td>
                        {row.parentName}
                        <br />
                        <span className="muted admin-cell-muted">{row.parentEmail}</span>
                      </td>
                      <td>
                        <span className={paymentTypeBadgeClass(row.paymentCategory)}>
                          {paymentTypeLabel(row.paymentCategory)}
                        </span>
                        <div className="muted admin-cell-muted" style={{ marginTop: "0.25rem" }}>
                          {paymentCategoryLabel(row.paymentFor)}
                        </div>
                      </td>
                      <td>{monthLabel}</td>
                      <td>{startsAt ? formatShortDate(startsAt) : "—"}</td>
                      <td>{endsAt ? formatShortDate(endsAt) : "—"}</td>
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
                              disabled={isBusy}
                              aria-busy={isBusy || undefined}
                              title={model.approveTooltip}
                              onClick={() => void patchPayment(row.id, "confirm")}
                            >
                              {isBusy ? "Approving…" : "Approve payment"}
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary admin-btn-sm"
                              disabled={isBusy}
                              aria-busy={isBusy || undefined}
                              title={model.reminderTooltip}
                              onClick={() => void patchPayment(row.id, "send_invoice")}
                            >
                              Send reminder
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary admin-btn-sm finance-void-btn"
                              disabled={isBusy}
                              aria-busy={isBusy || undefined}
                              title="Void this invoice (releases the player to receive a new monthly invoice). Use when the row is stale or duplicated."
                              onClick={() => void patchPayment(row.id, "void")}
                            >
                              Void
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
