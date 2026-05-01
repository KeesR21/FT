"use client";

import clsx from "clsx";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { adminApiFetch } from "@/lib/admin-api-fetch";
import { useAdminOverviewRefresh } from "@/lib/use-admin-overview-refresh";
import { ADMIN_OVERVIEW_REFRESH } from "@/lib/admin-client-events";
import type { PaymentStatus } from "@/lib/types";

function formatFriendlyDate(iso: string): string {
  const raw = iso.slice(0, 10);
  const [y, m, d] = raw.split("-").map(Number);
  if (!y || !m || !d) return raw;
  try {
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  } catch {
    return raw;
  }
}

function daysLeftLabel(days: number): string {
  if (days < 0) return "Membership period ended";
  if (days === 0) return "Ends today";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

function daysUrgencyClass(days: number): string {
  if (days <= 0) return "finance-days-chip finance-days-chip--urgent";
  if (days <= 2) return "finance-days-chip finance-days-chip--soon";
  return "finance-days-chip finance-days-chip--ok";
}

function formatCompactDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return iso;
  }
}

/** Real-time filter: case-insensitive substring on any provided field. */
function matchesInvoiceSearch(needle: string, ...haystackParts: (string | number | undefined | null)[]): boolean {
  const q = needle.trim().toLowerCase();
  if (!q) return true;
  const hay = haystackParts
    .filter((x) => x != null && String(x).length > 0)
    .map((x) => String(x).toLowerCase())
    .join(" ");
  return hay.includes(q);
}

type InvoiceSendConflict = {
  logId: string;
  sentAtLabel: string;
  hint: string;
};

type Eligible = {
  playerId: string;
  playerName: string;
  ageGroup: string;
  parentName: string;
  parentEmail: string;
  subscriptionValidUntil: string;
  daysLeft: number;
  canGenerateInvoice: boolean;
};

type InvoiceLogRow = {
  id: string;
  paymentId: string;
  playerId: string;
  playerName: string;
  parentName: string;
  invoiceNumber: string;
  generatedAt: string;
  dueDate: string;
  sentAt?: string;
  pdfUrl: string;
  paymentStatus: PaymentStatus;
};

type CombinedCandidate = {
  parentId: string;
  parentName: string;
  parentEmail: string;
  monthKey: string;
  dueDate: string;
  players: Array<{
    playerId: string;
    playerName: string;
    ageGroup: string;
    subscriptionValidUntil: string;
    daysLeft: number;
  }>;
};

type CombinedInvoiceLogRow = {
  id: string;
  parentId: string;
  parentEmail: string;
  parentName: string;
  invoiceNumber: string;
  periodLabel: string;
  dueDate: string;
  currency: string;
  total: number;
  generatedAt: string;
  sentAt?: string;
  pdfUrl: string;
  lineItems: Array<{
    paymentId: string;
    playerId: string;
    playerName: string;
    ageGroup: string;
    description: string;
    amount: number;
  }>;
  overallStatus: "paid" | "overdue" | "pending";
};

export default function FinanceInvoicesPage() {
  const [eligible, setEligible] = useState<Eligible[]>([]);
  const [logs, setLogs] = useState<InvoiceLogRow[]>([]);
  const [combinedCandidates, setCombinedCandidates] = useState<CombinedCandidate[]>([]);
  const [combinedLogs, setCombinedLogs] = useState<CombinedInvoiceLogRow[]>([]);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [sendConflict, setSendConflict] = useState<InvoiceSendConflict | null>(null);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  /** Shown when PDF auto-open may be blocked by the browser. */
  const [noticePdfUrl, setNoticePdfUrl] = useState<string | null>(null);

  function statusBadge(status: PaymentStatus): string {
    if (status === "paid") return "admin-pay-badge admin-pay-badge--blue";
    if (status === "overdue") return "admin-pay-badge admin-pay-badge--red";
    return "admin-pay-badge admin-pay-badge--orange";
  }

  function statusLabel(status: PaymentStatus): string {
    if (status === "paid") return "Paid";
    if (status === "overdue") return "Overdue";
    if (status === "expiring_soon") return "Due soon";
    return "Pending";
  }

  const invoiceSearchTrim = invoiceSearch.trim();

  const renewalReadyCount = useMemo(() => eligible.filter((p) => p.canGenerateInvoice).length, [eligible]);

  const eligibleFiltered = useMemo(() => {
    if (!invoiceSearchTrim) return eligible;
    return eligible.filter((p) =>
      matchesInvoiceSearch(
        invoiceSearchTrim,
        p.playerName,
        p.parentName,
        p.parentEmail,
        p.ageGroup,
        p.playerId,
        p.subscriptionValidUntil.slice(0, 10),
        formatFriendlyDate(p.subscriptionValidUntil),
        daysLeftLabel(p.daysLeft)
      )
    );
  }, [eligible, invoiceSearchTrim]);

  const renewalReadyFiltered = useMemo(
    () => eligibleFiltered.filter((p) => p.canGenerateInvoice).length,
    [eligibleFiltered]
  );

  const logsSorted = useMemo(
    () => [...logs].sort((a, b) => String(b.generatedAt).localeCompare(String(a.generatedAt))),
    [logs]
  );

  const logsFiltered = useMemo(() => {
    if (!invoiceSearchTrim) return logsSorted;
    return logsSorted.filter((l) =>
      matchesInvoiceSearch(
        invoiceSearchTrim,
        l.invoiceNumber,
        l.playerName,
        l.parentName,
        l.playerId,
        l.id,
        l.dueDate,
        l.generatedAt,
        l.sentAt,
        l.paymentStatus,
        l.pdfUrl
      )
    );
  }, [logsSorted, invoiceSearchTrim]);

  const logsByPlayer = useMemo(() => {
    const map = new Map<string, InvoiceLogRow>();
    for (const l of logsSorted) {
      if (!map.has(l.playerId)) map.set(l.playerId, l);
    }
    return map;
  }, [logsSorted]);

  const load = useCallback(async () => {
    try {
      const r = await adminApiFetch("/api/admin/invoices");
      if (!r.ok) return;
      const d = await r.json();
      setEligible(d.eligible ?? []);
      setLogs(d.logs ?? []);
      setCombinedCandidates(d.combinedCandidates ?? []);
      setCombinedLogs(d.combinedLogs ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useAdminOverviewRefresh(load);

  function openInvoicePdfTab(url: string) {
    if (typeof window === "undefined" || !url) return;
    try {
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.download = "";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      /* ignore */
    }
  }

  async function runAction(
    action: "generate" | "send" | "approve" | "remind" | "generate-combined" | "send-combined" | "approve-combined",
    payload: Record<string, string>
  ) {
    setBusy(`${action}:${Object.values(payload)[0] ?? ""}`);
    setErr("");
    setNotice("");
    setNoticePdfUrl(null);
    setSendConflict(null);
    try {
      const r = await adminApiFetch("/api/admin/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload })
      });
      const raw = await r.text();
      let data: Record<string, unknown> = {};
      try {
        data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      } catch {
        data = { message: raw ? raw.slice(0, 280) : `Request failed (${r.status})` };
      }
      if (!r.ok) {
        if (r.status === 409 && data?.code === "INVOICE_ALREADY_SENT" && typeof payload.logId === "string") {
          setSendConflict({
            logId: payload.logId,
            sentAtLabel: String(data.sentAtLabel || data.sentAt || "a previous time"),
            hint: String(
              data.hint || "Send a payment reminder instead of delivering the same invoice again."
            )
          });
          return;
        }
        setErr(String(data?.message || `Action failed (${r.status})`));
        return;
      }
      const msg = String(data?.message || "Done");
      setNotice(msg);
      const downloadUrl =
        typeof data.downloadUrl === "string"
          ? data.downloadUrl
          : data.log && typeof data.log === "object" && data.log !== null && "pdfUrl" in data.log
            ? String((data.log as { pdfUrl?: string }).pdfUrl ?? "")
            : data.combinedLog && typeof data.combinedLog === "object" && data.combinedLog !== null && "pdfUrl" in data.combinedLog
              ? String((data.combinedLog as { pdfUrl?: string }).pdfUrl ?? "")
              : "";
      if (
        (action === "generate" || action === "send" || action === "generate-combined" || action === "send-combined") &&
        downloadUrl
      ) {
        setNoticePdfUrl(downloadUrl);
        openInvoicePdfTab(downloadUrl);
      }
      window.dispatchEvent(new Event(ADMIN_OVERVIEW_REFRESH));
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="page-stack finance-page-stack" id="subscription-invoices-page" aria-label="Subscription invoices">
      <header className="card finance-hero">
        <span className="k-pill">FINANCE</span>
        <h1 className="page-h1">Subscription invoices</h1>
        <p className="page-lead muted">
          Create PDF invoices when a player&apos;s current month is almost up (within five days of the end date). Then
          send, follow up, and record payment from the logs below—everything stays in one place.
        </p>
        <div className="finance-hero__search">
          <label className="finance-hero__search-label" htmlFor="invoice-realtime-search">
            Search this page
          </label>
          <div className="finance-hero__search-row">
            <input
              id="invoice-realtime-search"
              type="search"
              className="input-field finance-hero__search-input"
              autoComplete="off"
              placeholder="Player, parent, email, invoice #, dates, status…"
              value={invoiceSearch}
              onChange={(e) => setInvoiceSearch(e.target.value)}
              aria-controls="subscription-invoices-page"
            />
            {invoiceSearchTrim ? (
              <button type="button" className="btn btn-secondary admin-btn-sm" onClick={() => setInvoiceSearch("")}>
                Clear
              </button>
            ) : null}
          </div>
        </div>
        <Link href="/admin/finance/transactions" className="ks-text-link">
          View all invoices in transactions →
        </Link>
      </header>

      {err ? <p className="form-message">{err}</p> : null}
      {sendConflict ? (
        <div className="finance-invoice-send-warn" role="alert">
          <p className="finance-invoice-send-warn__title">This invoice was already sent</p>
          <p className="finance-invoice-send-warn__body">
            The parent received it on <strong>{sendConflict.sentAtLabel}</strong>. Resending the same invoice can look
            unprofessional and confuse guardians.
          </p>
          <p className="finance-invoice-send-warn__hint">{sendConflict.hint}</p>
          <div className="finance-invoice-send-warn__actions">
            <button
              type="button"
              className="btn admin-btn-sm finance-invoice-send-warn__cta"
              disabled={busy === `remind:${sendConflict.logId}`}
              onClick={() => void runAction("remind", { logId: sendConflict.logId })}
            >
              {busy === `remind:${sendConflict.logId}` ? "Sending reminder…" : "Send payment reminder instead"}
            </button>
            <button type="button" className="btn btn-secondary admin-btn-sm" onClick={() => setSendConflict(null)}>
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
      {notice ? (
        <div className="finance-toast finance-toast--ok" role="status">
          <p className="finance-toast__text">{notice}</p>
          {noticePdfUrl ? (
            <p className="finance-toast__pdf">
              <a className="ks-text-link" href={noticePdfUrl} target="_blank" rel="noopener noreferrer">
                Open invoice PDF
              </a>{" "}
              if it didn&apos;t open automatically.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="card finance-panel finance-eligible-panel">
        <div className="finance-eligible-panel__intro">
          <div className="finance-eligible-panel__titles">
            <h2 className="finance-eligible-panel__title">Renewal invoices</h2>
            <p className="finance-eligible-panel__lead">
              Players listed here have a membership end date on file. When someone is within <strong>five days</strong> of
              that date, you can create their next PDF invoice in one click. Rows with a soft highlight are in that window
              now.
            </p>
            {eligible.length > 0 ? (
              <p className="finance-eligible-panel__hint">
                Showing <strong>{eligible.length}</strong> {eligible.length === 1 ? "player" : "players"} with an active
                end date
                {renewalReadyCount > 0 ? (
                  <>
                    {" "}
                    · <strong>{renewalReadyCount}</strong> {renewalReadyCount === 1 ? "is" : "are"} ready to invoice
                  </>
                ) : null}
                .
              </p>
            ) : null}
          </div>
          {eligible.length > 0 ? (
            <div
              className={clsx(
                "finance-eligible-stat",
                (invoiceSearchTrim ? renewalReadyFiltered : renewalReadyCount) === 0 && "finance-eligible-stat--zero"
              )}
              aria-live="polite"
            >
              <span className="finance-eligible-stat__value">
                {invoiceSearchTrim ? renewalReadyFiltered : renewalReadyCount}
              </span>
              <span className="finance-eligible-stat__label">
                {(invoiceSearchTrim ? renewalReadyFiltered : renewalReadyCount) === 0
                  ? "In the 5-day window"
                  : (invoiceSearchTrim ? renewalReadyFiltered : renewalReadyCount) === 1
                    ? "Player ready"
                    : "Players ready"}
              </span>
            </div>
          ) : null}
        </div>

        {eligible.length === 0 ? (
          <div className="finance-eligible-empty">
            <p className="finance-eligible-empty__title">All quiet on renewals</p>
            <p className="finance-eligible-empty__text">
              There are no approved players with a membership end date right now, or nobody is close enough to their end
              date to need a new invoice. Check back as dates approach—you&apos;ll see them appear here automatically.
            </p>
          </div>
        ) : null}

        {eligible.length > 0 ? (
          <div className="admin-table-wrap finance-eligible-table-wrap">
            <table className="admin-table finance-table finance-eligible-table">
              <thead>
                <tr>
                  <th className="finance-eligible-col finance-eligible-col--player">Player</th>
                  <th className="finance-eligible-col finance-eligible-col--parent">Parent / contact</th>
                  <th className="finance-eligible-col finance-eligible-col--period">Current period ends</th>
                  <th className="finance-eligible-col finance-eligible-col--last">Last invoice</th>
                  <th className="finance-eligible-col finance-eligible-col--action">Next step</th>
                </tr>
              </thead>
              <tbody>
                {eligibleFiltered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="finance-table-empty">
                      <p className="finance-table-empty__title">No matching players</p>
                      <p className="muted finance-table-empty__text">
                        Nothing on this list matches &quot;{invoiceSearchTrim}&quot;. Try another name, email, or clear
                        the search.
                      </p>
                    </td>
                  </tr>
                ) : null}
                {eligibleFiltered.map((p) => {
                  const last = logsByPlayer.get(p.playerId);
                  return (
                    <tr
                      key={p.playerId}
                      className={clsx(
                        p.canGenerateInvoice && "finance-eligible-row--ready admin-pay-row--attention"
                      )}
                    >
                      <td className="finance-eligible-col finance-eligible-col--player">
                        <span className="finance-eligible-cell__primary">{p.playerName}</span>
                        <div className="muted admin-cell-muted">{p.ageGroup}</div>
                      </td>
                      <td className="finance-eligible-col finance-eligible-col--parent">
                        <span className="finance-eligible-cell__primary">{p.parentName}</span>
                        <div className="muted admin-cell-muted">{p.parentEmail || "—"}</div>
                      </td>
                      <td className="finance-eligible-col finance-eligible-col--period">
                        <span className="finance-eligible-cell__primary">{formatFriendlyDate(p.subscriptionValidUntil)}</span>
                        <div className="finance-eligible-chip-row">
                          <span className={daysUrgencyClass(p.daysLeft)}>{daysLeftLabel(p.daysLeft)}</span>
                          {!p.canGenerateInvoice ? (
                            <span className="finance-eligible-note">Invoice unlocks in the last 5 days</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="finance-eligible-col finance-eligible-col--last">
                        {last ? (
                          <div className="finance-last-invoice-cell">
                            <time
                              className="finance-last-invoice-cell__time"
                              dateTime={last.sentAt ?? last.generatedAt}
                              title={last.sentAt ? "Sent to parent" : "Generated (not sent yet)"}
                            >
                              {last.sentAt
                                ? `Sent ${formatCompactDateTime(last.sentAt)}`
                                : `Created ${formatCompactDateTime(last.generatedAt)}`}
                            </time>
                            <span className={`finance-last-invoice-cell__pill ${statusBadge(last.paymentStatus)}`}>
                              {statusLabel(last.paymentStatus)}
                            </span>
                          </div>
                        ) : (
                          <span className="admin-pay-badge admin-pay-badge--muted">—</span>
                        )}
                      </td>
                      <td className="finance-eligible-col finance-eligible-col--action">
                        {p.canGenerateInvoice ? (
                          <button
                            type="button"
                            className="btn ledger-action-btn finance-eligible-action-btn"
                            title="Generate this month's PDF invoice and download it"
                            disabled={busy === `generate:${p.playerId}`}
                            onClick={() => void runAction("generate", { playerId: p.playerId })}
                          >
                            {busy === `generate:${p.playerId}` ? "Working…" : "Create PDF invoice"}
                          </button>
                        ) : (
                          <span className="finance-eligible-wait muted admin-cell-muted">Not yet—watch the countdown</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <div className="card finance-panel" id="combined-billing-section">
        <div className="finance-panel__head">
          <div>
            <h2 className="finance-panel__title">Combined family billing</h2>
            <p className="finance-panel__meta muted">
              When a parent has <strong>two or more players</strong> renewing in the same calendar month, you can send
              one bill instead of separate invoices. Per-player ledger rows are still created so payment status stays
              accurate.
            </p>
          </div>
          {combinedCandidates.length > 0 ? (
            <p className="finance-panel__meta muted">
              <strong>{combinedCandidates.length}</strong> {combinedCandidates.length === 1 ? "family" : "families"} ready
              to bill together
            </p>
          ) : null}
        </div>

        {combinedCandidates.length === 0 ? (
          <p className="muted">
            No families currently have two or more renewals in the same month inside the 5-day window. As more siblings
            approach their end date together, candidates will appear here.
          </p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table finance-table">
              <thead>
                <tr>
                  <th>Parent</th>
                  <th>Players renewing this month</th>
                  <th>Bundled due date</th>
                  <th className="finance-table__col--actions">Action</th>
                </tr>
              </thead>
              <tbody>
                {combinedCandidates.map((c) => {
                  const busyKey = `generate-combined:${c.parentId}`;
                  return (
                    <tr key={`${c.parentId}-${c.monthKey}`} className="admin-pay-row--attention">
                      <td>
                        <strong>{c.parentName}</strong>
                        <div className="muted admin-cell-muted">{c.parentEmail || "—"}</div>
                      </td>
                      <td>
                        <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
                          {c.players.map((p) => (
                            <li key={p.playerId}>
                              {p.playerName}{" "}
                              <span className="muted admin-cell-muted">
                                ({p.ageGroup} · {daysLeftLabel(p.daysLeft)})
                              </span>
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td>
                        <span className="finance-eligible-cell__primary">{formatFriendlyDate(c.dueDate)}</span>
                        <div className="muted admin-cell-muted">{c.players.length} players</div>
                      </td>
                      <td className="finance-table__col--actions">
                        <button
                          type="button"
                          className="btn ledger-action-btn"
                          disabled={busy === busyKey}
                          onClick={() =>
                            void runAction("generate-combined", { parentId: c.parentId, dueDate: c.dueDate })
                          }
                          title="Create one combined PDF invoice for this parent and all their renewing players"
                        >
                          {busy === busyKey ? "Working…" : "Create combined invoice"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {combinedLogs.length > 0 ? (
          <div className="admin-table-wrap" style={{ marginTop: "1.25rem" }}>
            <table className="admin-table finance-table">
              <thead>
                <tr>
                  <th>Combined invoice #</th>
                  <th>Parent</th>
                  <th>Players</th>
                  <th>Total</th>
                  <th>Sent</th>
                  <th>Status</th>
                  <th className="finance-table__col--actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {combinedLogs.map((l) => {
                  const sendBusy = busy === `send-combined:${l.id}`;
                  const approveBusy = busy === `approve-combined:${l.id}`;
                  return (
                    <tr key={l.id} className={l.overallStatus !== "paid" ? "admin-pay-row--attention" : undefined}>
                      <td>
                        <strong>{l.invoiceNumber}</strong>
                        <div className="muted admin-cell-muted">due {l.dueDate.slice(0, 10)}</div>
                      </td>
                      <td>
                        {l.parentName}
                        <div className="muted admin-cell-muted">{l.parentEmail || "—"}</div>
                      </td>
                      <td>
                        <span>{l.lineItems.length} players</span>
                        <div className="muted admin-cell-muted">
                          {l.lineItems.map((li) => li.playerName).join(", ")}
                        </div>
                      </td>
                      <td>
                        <strong>
                          {l.total.toLocaleString()} {l.currency}
                        </strong>
                      </td>
                      <td>{l.sentAt ? l.sentAt.slice(0, 10) : "Not sent"}</td>
                      <td>
                        <span
                          className={
                            l.overallStatus === "paid"
                              ? "admin-pay-badge admin-pay-badge--blue"
                              : l.overallStatus === "overdue"
                                ? "admin-pay-badge admin-pay-badge--red"
                                : "admin-pay-badge admin-pay-badge--orange"
                          }
                        >
                          {l.overallStatus === "paid"
                            ? "All paid"
                            : l.overallStatus === "overdue"
                              ? "Overdue"
                              : "Pending"}
                        </span>
                      </td>
                      <td className="finance-table__col--actions">
                        <div className="approvals-actions-stack finance-invoice-log-actions">
                          <a
                            className="btn btn-secondary ledger-action-btn"
                            href={l.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Open PDF
                          </a>
                          {!l.sentAt ? (
                            <button
                              type="button"
                              className="btn ledger-action-btn"
                              disabled={sendBusy}
                              onClick={() => void runAction("send-combined", { combinedLogId: l.id })}
                            >
                              {sendBusy ? "Sending…" : "Send to parent"}
                            </button>
                          ) : null}
                          {l.overallStatus !== "paid" ? (
                            <button
                              type="button"
                              className="btn ledger-action-btn"
                              disabled={approveBusy}
                              title="Approve every line item on this combined invoice and renew memberships"
                              onClick={() => void runAction("approve-combined", { combinedLogId: l.id })}
                            >
                              {approveBusy ? "Approving…" : "Approve all"}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <div className="card finance-panel">
        <div className="finance-panel__head">
          <div>
            <h2 className="finance-panel__title">Invoice logs</h2>
            {logs.length > 0 ? (
              <p className="finance-panel__meta muted">
                {invoiceSearchTrim ? (
                  <>
                    Showing <strong>{logsFiltered.length}</strong> of <strong>{logs.length}</strong> log
                    {logs.length === 1 ? "" : "s"}
                  </>
                ) : (
                  <>
                    <strong>{logs.length}</strong> invoice log{logs.length === 1 ? "" : "s"}
                  </>
                )}
              </p>
            ) : null}
          </div>
        </div>
        {logs.length === 0 ? <p className="muted">No invoice logs yet.</p> : null}
        {logs.length > 0 ? (
          <div className="admin-table-wrap">
            <table className="admin-table finance-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Player</th>
                  <th>Generated</th>
                  <th>Sent</th>
                  <th>Payment status</th>
                  <th className="finance-table__col--actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {logsFiltered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="finance-table-empty">
                      <p className="finance-table-empty__title">No matching invoice logs</p>
                      <p className="muted finance-table-empty__text">
                        Nothing matches &quot;{invoiceSearchTrim}&quot;. Try invoice number, player name, or clear the
                        search.
                      </p>
                    </td>
                  </tr>
                ) : null}
                {logsFiltered.map((l) => {
                  const paid = l.paymentStatus === "paid";
                  const pending = l.paymentStatus === "pending" || l.paymentStatus === "not_paid" || l.paymentStatus === "expiring_soon";
                  return (
                    <tr key={l.id} className={!paid ? "admin-pay-row--attention" : undefined}>
                      <td>
                        <strong>{l.invoiceNumber}</strong>
                        <div className="muted admin-cell-muted">due {l.dueDate.slice(0, 10)}</div>
                      </td>
                      <td>
                        {l.playerName}
                        <div className="muted admin-cell-muted">{l.parentName}</div>
                      </td>
                      <td>{l.generatedAt.slice(0, 10)}</td>
                      <td>{l.sentAt ? l.sentAt.slice(0, 10) : "Not sent"}</td>
                      <td>
                        <span className={statusBadge(l.paymentStatus)}>
                          {l.paymentStatus === "paid"
                            ? "Paid"
                            : l.paymentStatus === "overdue"
                              ? "Overdue"
                              : l.paymentStatus === "expiring_soon"
                                ? "Due soon"
                                : "Pending"}
                        </span>
                      </td>
                      <td className="finance-table__col--actions">
                        <div className="approvals-actions-stack finance-invoice-log-actions">
                          <a
                            className="btn btn-secondary ledger-action-btn"
                            href={l.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Open PDF
                          </a>
                          {!l.sentAt ? (
                            <button
                              type="button"
                              className="btn ledger-action-btn"
                              title="Send this invoice to parent"
                              disabled={busy === `send:${l.id}`}
                              onClick={() => void runAction("send", { logId: l.id })}
                            >
                              {busy === `send:${l.id}` ? "Sending…" : "Send invoice"}
                            </button>
                          ) : null}
                          {!paid ? (
                            <button
                              type="button"
                              className="btn ledger-action-btn"
                              title="Approve payment and renew subscription"
                              disabled={busy === `approve:${l.id}`}
                              onClick={() => void runAction("approve", { logId: l.id })}
                            >
                              {busy === `approve:${l.id}` ? "Approving…" : "Approve payment"}
                            </button>
                          ) : null}
                          {pending ? (
                            <button
                              type="button"
                              className="btn btn-secondary ledger-action-btn"
                              title="Send reminder to parent for unpaid invoice"
                              disabled={busy === `remind:${l.id}`}
                              onClick={() => void runAction("remind", { logId: l.id })}
                            >
                              {busy === `remind:${l.id}` ? "Sending…" : "Send reminder"}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}
