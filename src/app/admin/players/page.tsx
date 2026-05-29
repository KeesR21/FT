"use client";

import clsx from "clsx";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { adminApiFetch, readAdminApiError } from "@/lib/admin-api-fetch";
import type { AdminOverviewRefreshDetail } from "@/lib/admin-client-events";
import { useAdminOverviewRefresh } from "@/lib/use-admin-overview-refresh";
import { AGE_GROUPS } from "@/lib/age-groups";

type Row = {
  id: string;
  playerName: string;
  ageGroup: string;
  status: string;
  registrationStatus: string;
  subscriptionUi: string;
  parent?: { parentName: string; email: string } | null;
  playerDanger?: boolean;
  playerOverdueDays?: number;
};

type VerifyIssue = {
  rowNumber: number;
  field: string;
  message: string;
  severity: "critical" | "warning";
};

type VerifyValidRow = {
  rowNumber: number;
  playerName: string;
  ageGroup?: string;
};

type VerifyInvalidRow = {
  rowNumber: number;
  row: VerifyValidRow & Record<string, unknown>;
  errors: VerifyIssue[];
};

type VerifyPayload = {
  summary: { totalRows: number; validRows: number; invalidRows: number; issues: number };
  missingColumns: string[];
  validRows: VerifyValidRow[];
  invalidRows: VerifyInvalidRow[];
  issues: VerifyIssue[];
};

export default function AdminPlayersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [withdrawn, setWithdrawn] = useState(false);
  const [group, setGroup] = useState("");
  const [registration, setRegistration] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [verifyResult, setVerifyResult] = useState<VerifyPayload | null>(null);
  const [allowPartial, setAllowPartial] = useState(false);
  const [phase, setPhase] = useState<"idle" | "verifying" | "importing">("idle");
  const [dragActive, setDragActive] = useState(false);

  const load = useCallback(async (detail?: AdminOverviewRefreshDetail) => {
    const silent = Boolean(detail?.silent);
    if (!silent) {
      setLoading(true);
      setErr("");
    }
    try {
      const q = new URLSearchParams();
      if (withdrawn) q.set("withdrawn", "1");
      if (group) q.set("group", group);
      q.set("registration", registration);
      const r = await adminApiFetch(`/api/admin/players?${q}`);
      if (!r.ok) throw new Error(await readAdminApiError(r));
      const data = await r.json();
      setRows(data.players);
    } catch (e) {
      if (!silent) setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [withdrawn, group, registration]);

  useEffect(() => {
    load();
  }, [load]);

  useAdminOverviewRefresh(load);

  function resetImportState() {
    setVerifyResult(null);
    setImportMsg("");
    setAllowPartial(false);
  }

  function onFilePicked(file: File | null) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setErr("Please upload a .csv file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErr("CSV is too large. Maximum file size is 5 MB.");
      return;
    }
    setErr("");
    setImportFile(file);
    resetImportState();
  }

  async function verifyImportFile() {
    setErr("");
    setImportMsg("");
    if (!importFile) {
      setErr("Choose a CSV file first.");
      return;
    }
    setImportBusy(true);
    setPhase("verifying");
    try {
      const fd = new FormData();
      fd.append("file", importFile);
      const r = await adminApiFetch("/api/admin/players/import/verify", {
        method: "POST",
        body: fd
      });
      const payload = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(payload?.message || "Import failed");
      const verified = payload as VerifyPayload;
      setVerifyResult(verified);
      if (verified.missingColumns.length > 0) {
        setErr(`Missing required columns: ${verified.missingColumns.join(", ")}`);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setImportBusy(false);
      setPhase("idle");
    }
  }

  async function runImport() {
    if (!verifyResult) return;
    setErr("");
    setImportMsg("");
    setImportBusy(true);
    setPhase("importing");
    try {
      const r = await adminApiFetch("/api/admin/players/import/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: verifyResult.validRows,
          allowPartial
        })
      });
      const payload = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(payload?.message || "Import failed");
      const s = payload?.summary ?? {};
      setImportMsg(`Imported ${s.imported ?? 0} of ${s.requested ?? verifyResult.summary.totalRows} row(s).`);
      setVerifyResult(null);
      setImportFile(null);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImportBusy(false);
      setPhase("idle");
    }
  }

  function badgeSub(s: string) {
    if (s === "active") return "admin-badge--success";
    if (s === "expiring_soon") return "admin-badge--warn";
    if (s === "expired" || s === "ended") return "admin-badge--danger";
    return "admin-badge--muted";
  }

  function badgeReg(s: string) {
    if (s === "pending") return "admin-badge--warn";
    if (s === "approved") return "admin-badge--success";
    if (s === "rejected") return "admin-badge--danger";
    return "admin-badge--muted";
  }

  return (
    <section className="page-stack">
      <div className="card page-hero-card">
        <span className="k-pill">PLAYERS</span>
        <h1 className="page-h1">Player management</h1>
        <p className="page-lead muted">
          Full roster with parent contacts, subscription state, and links to profiles. Withdrawn players stay in the archive.
        </p>
      </div>

      <div className="card">
        <h2>Roster import (CSV)</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Upload CSV, verify all rows, then import. Template includes required columns and examples. Imports create draft
          profiles that admins complete one by one.
        </p>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
          <Link className="btn btn-secondary" href="/api/admin/players/import/template">
            Download CSV template
          </Link>
        </div>
        <div
          className="card"
          style={{
            borderStyle: "dashed",
            borderColor: dragActive ? "#2563eb" : undefined,
            background: dragActive ? "rgba(239,246,255,0.65)" : undefined
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragActive(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            const file = e.dataTransfer.files?.[0] ?? null;
            onFilePicked(file);
          }}
        >
          <label className="form-label" style={{ marginBottom: "0.5rem" }}>
            <span>Upload CSV (UTF-8, max 5 MB)</span>
            <input
              className="input-field"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                onFilePicked(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
          </label>
          <p className="muted" style={{ margin: 0 }}>
            Drag and drop file here, or choose file above. Required columns: <code>playerName</code>,{" "}
            <code>dateOfBirth</code>, <code>parentEmail</code>. Optional: <code>ageGroup</code>.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" className="btn" onClick={() => void verifyImportFile()} disabled={importBusy || !importFile}>
            {phase === "verifying" ? "Verifying..." : "Verify CSV"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setImportFile(null);
              resetImportState();
            }}
            disabled={importBusy}
          >
            Clear
          </button>
          <span className="muted">{importFile ? `Selected: ${importFile.name}` : "No file selected"}</span>
        </div>
        {importMsg ? (
          <p className="muted" style={{ marginTop: "0.65rem" }}>
            {importMsg}
          </p>
        ) : null}
        {verifyResult ? (
          <div style={{ marginTop: "1rem" }}>
            <h3 style={{ marginBottom: "0.4rem" }}>Validation summary</h3>
            <p className="muted" style={{ marginTop: 0 }}>
              Total: {verifyResult.summary.totalRows} · Valid: {verifyResult.summary.validRows} · Invalid:{" "}
              {verifyResult.summary.invalidRows}
            </p>
            {verifyResult.invalidRows.length > 0 ? (
              <div className="admin-table-wrap" style={{ marginTop: "0.5rem" }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Field</th>
                      <th>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verifyResult.invalidRows.flatMap((x) =>
                      x.errors.map((e, idx) => (
                        <tr key={`${x.rowNumber}-${e.field}-${idx}`}>
                          <td>{x.rowNumber}</td>
                          <td>{e.field}</td>
                          <td>{e.message}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : null}
            <label className="form-label admin-filter-checkbox" style={{ marginTop: "0.6rem" }}>
              <input type="checkbox" checked={allowPartial} onChange={(e) => setAllowPartial(e.target.checked)} />
              <span>Allow partial import (import only valid rows)</span>
            </label>
            <button
              type="button"
              className="btn"
              style={{ marginTop: "0.45rem" }}
              disabled={importBusy || verifyResult.validRows.length === 0 || (verifyResult.invalidRows.length > 0 && !allowPartial)}
              onClick={() => void runImport()}
            >
              {phase === "importing" ? "Importing..." : "Import valid rows"}
            </button>
          </div>
        ) : null}
      </div>

      <div className="card">
        <h2>Filters</h2>
        <div className="admin-filters">
          <label className="form-label">
            <span>Age group</span>
            <select className="input-field" value={group} onChange={(e) => setGroup(e.target.value)}>
              <option value="">All groups</option>
              {AGE_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label className="form-label">
            <span>Registration</span>
            <select
              className="input-field"
              value={registration}
              onChange={(e) => setRegistration(e.target.value as typeof registration)}
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>
          <label className="form-label admin-filter-checkbox">
            <input type="checkbox" checked={withdrawn} onChange={(e) => setWithdrawn(e.target.checked)} />
            <span>Include withdrawn</span>
          </label>
        </div>

        {err ? <p className="form-message">{err}</p> : null}
        {loading ? <p className="muted">Loading…</p> : null}

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Group</th>
                <th>Parent</th>
                <th>Registration</th>
                <th>Subscription</th>
                <th>Player status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const isWithdrawn = p.status === "withdrawn";
                const isDanger = !isWithdrawn && Boolean(p.playerDanger);
                return (
                <tr
                  key={p.id}
                  className={clsx(
                    isWithdrawn && "admin-table-row--withdrawn",
                    isDanger && "admin-pay-row--danger"
                  )}
                >
                  <td>
                    <span className="admin-table-cell-player">
                      {isWithdrawn ? (
                        <span className="admin-withdrawn-flag" title="Withdrawn from academy" aria-hidden>
                          🚩
                        </span>
                      ) : null}
                      <span className={clsx(isWithdrawn && "admin-text-withdrawn")}>{p.playerName}</span>
                      {isWithdrawn ? (
                        <span className="admin-withdrawn-pill" title="This player has left the club">
                          Withdrawn
                        </span>
                      ) : null}
                      {isDanger ? (
                        <span
                          className="admin-danger-flag"
                          title={`Subscription overdue by ${p.playerOverdueDays ?? 0} day(s)`}
                        >
                          DANGER
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td>{p.ageGroup}</td>
                  <td>
                    {p.parent ? (
                      <>
                        {p.parent.parentName}
                        <br />
                        <span className="muted admin-cell-muted">{p.parent.email}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <span className={`admin-badge ${badgeReg(p.registrationStatus)}`}>{p.registrationStatus}</span>
                  </td>
                  <td>
                    <span className={`admin-badge ${badgeSub(p.subscriptionUi)}`}>{p.subscriptionUi.replace("_", " ")}</span>
                  </td>
                  <td>
                    <span className={`admin-badge ${p.status === "active" ? "admin-badge--success" : "admin-badge--danger"}`}>
                      {p.status}
                    </span>
                  </td>
                  <td>
                    <Link href={`/admin/players/${p.id}`} className="btn btn-secondary admin-btn-sm">
                      Open
                    </Link>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
