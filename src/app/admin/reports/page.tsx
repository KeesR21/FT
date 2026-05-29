"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ADMIN_OVERVIEW_REFRESH, type AdminOverviewRefreshDetail } from "@/lib/admin-client-events";
import { adminApiFetch, parseAdminApiBody, readAdminApiError } from "@/lib/admin-api-fetch";
import { useAdminOverviewRefresh } from "@/lib/use-admin-overview-refresh";

type ReportData = {
  generatedAt: string;
  financial: {
    overall: { totalInvoices: number; totalPaid: number; totalOutstanding: number };
    byGroup: Array<{ ageGroup: string; paid: number; outstanding: number; totalInvoices: number }>;
    byPlayer: Array<{ playerId: string; playerName: string; ageGroup: string; paid: number; outstanding: number }>;
  };
  registrations: {
    totalPlayers: number;
    rosterBreakdown?: {
      activeOnRoster: number;
      pendingApplications: number;
      withdrawnArchived: number;
      totalRecords: number;
    };
    byAgeGroup: Array<{ ageGroup: string; count: number }>;
    byRegistrationDate: Array<{ date: string; count: number }>;
  };
};

const money = new Intl.NumberFormat("en-RW", { style: "currency", currency: "RWF" });

export default function AdminReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploadStatus, setUploadStatus] = useState("");

  const load = useCallback(async (detail?: AdminOverviewRefreshDetail) => {
    const silent = Boolean(detail?.silent);
    if (!silent) {
      setLoading(true);
      setError("");
    }
    try {
      const r = await adminApiFetch("/api/admin/reports");
      if (!r.ok) throw new Error(await readAdminApiError(r));
      setData(await r.json());
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : "Failed to load reports");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useAdminOverviewRefresh(load);

  const topPlayers = useMemo(
    () => (data?.financial.byPlayer ?? []).slice().sort((a, b) => b.paid - a.paid).slice(0, 8),
    [data]
  );

  async function uploadRoster(file: File) {
    setUploadStatus("Uploading roster...");
    const form = new FormData();
    form.append("file", file);
    const r = await adminApiFetch("/api/admin/roster/upload", {
      method: "POST",
      body: form
    });
    const parsed = await parseAdminApiBody<unknown>(r);
    if (!parsed.ok) {
      setUploadStatus(`Upload failed: ${parsed.message}`);
      return;
    }
    setUploadStatus("Roster uploaded successfully.");
    window.dispatchEvent(new Event(ADMIN_OVERVIEW_REFRESH));
  }

  return (
    <section className="page-stack">
      <div className="card page-hero-card">
        <span className="k-pill">REPORTS</span>
        <h1 className="page-h1">Reports & data management</h1>
        <p className="page-lead muted">
          Financial reports, registration insights, CSV/Excel exports, and bulk roster upload.
        </p>
      </div>

      <div className="card">
        <h2>Data tools</h2>
        <div className="k-two-col card-cta-row">
          <a className="btn" href="/api/admin/export?dataset=players&format=csv">
            Export players CSV
          </a>
          <a className="btn btn-secondary" href="/api/admin/export?dataset=payments&format=csv">
            Export payments CSV
          </a>
          <a className="btn btn-secondary" href="/api/admin/export?dataset=financial&format=xlsx">
            Export financial Excel
          </a>
          <a className="btn btn-secondary" href="/api/admin/export?dataset=registrations&format=xlsx">
            Export registration Excel
          </a>
          <a className="btn btn-secondary" href="/api/admin/roster/template">
            Download roster template
          </a>
          <label className="btn btn-secondary" style={{ display: "inline-flex", cursor: "pointer" }}>
            Upload roster Excel/CSV
            <input
              hidden
              type="file"
              accept=".csv,.xlsx,.xls,.xlsm"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadRoster(file);
              }}
            />
          </label>
        </div>
        {uploadStatus ? <p className="admin-cell-muted">{uploadStatus}</p> : null}
      </div>

      <div className="card">
        {error ? <p className="form-message">{error}</p> : null}
        {loading ? <p className="muted">Loading…</p> : null}
        {data ? (
          <>
            <p className="admin-cell-muted">Generated: {new Date(data.generatedAt).toLocaleString()}</p>
            <div className="admin-dash-stats">
              <div className="admin-stat-card">
                <div className="admin-stat-card-body">
                  <h3>Total paid</h3>
                  <p className="admin-stat-card-value">{money.format(data.financial.overall.totalPaid)}</p>
                </div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-card-body">
                  <h3>Outstanding</h3>
                  <p className="admin-stat-card-value">{money.format(data.financial.overall.totalOutstanding)}</p>
                </div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-card-body">
                  <h3>Roster &amp; records</h3>
                  {data.registrations.rosterBreakdown ? (
                    <>
                      <p className="admin-stat-card-value">{data.registrations.rosterBreakdown.activeOnRoster}</p>
                      <p className="admin-stat-card-trend">
                        Active on roster (approved, not withdrawn)
                      </p>
                      <p className="admin-cell-muted" style={{ marginTop: "0.5rem", fontSize: "0.85rem", lineHeight: 1.45 }}>
                        {data.registrations.rosterBreakdown.pendingApplications} pending application
                        {data.registrations.rosterBreakdown.pendingApplications === 1 ? "" : "s"} ·{" "}
                        {data.registrations.rosterBreakdown.withdrawnArchived} withdrawn (archive) ·{" "}
                        <strong>{data.registrations.rosterBreakdown.totalRecords}</strong> total records in database
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="admin-stat-card-value">{data.registrations.totalPlayers}</p>
                      <p className="admin-stat-card-trend">All player records (reload after update)</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="admin-table-wrap" style={{ marginTop: "1rem" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Group</th>
                    <th>Paid</th>
                    <th>Outstanding</th>
                    <th>Invoices</th>
                  </tr>
                </thead>
                <tbody>
                  {data.financial.byGroup.map((row) => (
                    <tr key={row.ageGroup}>
                      <td>{row.ageGroup}</td>
                      <td>{money.format(row.paid)}</td>
                      <td>{money.format(row.outstanding)}</td>
                      <td>{row.totalInvoices}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="admin-table-wrap" style={{ marginTop: "1rem" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Top player</th>
                    <th>Group</th>
                    <th>Paid</th>
                    <th>Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {topPlayers.map((row) => (
                    <tr key={row.playerId}>
                      <td>{row.playerName}</td>
                      <td>{row.ageGroup}</td>
                      <td>{money.format(row.paid)}</td>
                      <td>{money.format(row.outstanding)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
