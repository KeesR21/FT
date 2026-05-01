"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { adminApiFetch } from "@/lib/admin-api-fetch";
import { useAdminOverviewRefresh } from "@/lib/use-admin-overview-refresh";
import { formatAcademyMoney } from "@/lib/finance-format";

type ReportData = {
  generatedAt: string;
  financial: {
    overall: { totalInvoices: number; totalPaid: number; totalOutstanding: number };
    byGroup: Array<{ ageGroup: string; paid: number; outstanding: number; totalInvoices: number }>;
    byPlayer: Array<{
      playerId: string;
      playerName: string;
      ageGroup: string;
      paid: number;
      outstanding: number;
      invoiceCount: number;
    }>;
  };
};

export default function FinanceReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const r = await adminApiFetch("/api/admin/reports");
      if (!r.ok) throw new Error(await r.text());
      setData(await r.json());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useAdminOverviewRefresh(load);

  const exportQs = useMemo(() => {
    const p = new URLSearchParams();
    if (dateFrom) p.set("dateFrom", dateFrom);
    if (dateTo) p.set("dateTo", dateTo);
    return p.toString();
  }, [dateFrom, dateTo]);

  const topPlayers = useMemo(() => {
    const list = data?.financial.byPlayer ?? [];
    return [...list].sort((a, b) => b.paid - a.paid).slice(0, 10);
  }, [data]);

  return (
    <section className="page-stack finance-page-stack">
      <header className="card finance-hero">
        <span className="k-pill">FINANCE</span>
        <h1 className="page-h1">Reports &amp; exports</h1>
        <p className="page-lead muted">
          Aggregated balances from the live ledger. For row-level exports, use date filters below (due date) with CSV or
          printable HTML.
        </p>
      </header>

      <div className="card finance-filters-card">
        <h2 className="finance-panel__title">Export payments (filtered)</h2>
        <div className="finance-filter-grid">
          <label className="form-label">
            <span>Due from</span>
            <input className="input-field" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label className="form-label">
            <span>Due to</span>
            <input className="input-field" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
        </div>
        <div className="finance-export-row">
          <a className="btn btn-secondary finance-btn-sm" href={`/api/admin/export?dataset=payments&format=csv&${exportQs}`}>
            Download CSV
          </a>
          <a className="btn btn-secondary finance-btn-sm" href={`/api/admin/export?dataset=payments&format=html&${exportQs}`}>
            Download HTML (print to PDF)
          </a>
          <a className="btn btn-secondary finance-btn-sm" href="/api/admin/export?dataset=financial&format=xlsx">
            Financial workbook (Excel)
          </a>
          <a className="btn btn-secondary finance-btn-sm" href="/api/admin/export?dataset=registrations&format=xlsx">
            Registrations workbook
          </a>
        </div>
        <p className="finance-help">
          PDF: use the HTML export and your browser&apos;s <strong>Print → Save as PDF</strong> for a pixel-perfect
          document.
        </p>
      </div>

      <div className="card finance-panel finance-panel--muted">
        <h2 className="finance-panel__title">Roster &amp; bulk tools</h2>
        <p className="muted">Player uploads and non-financial CSVs stay on the main reports hub.</p>
        <Link href="/admin/reports" className="btn btn-secondary">
          Open full reports hub
        </Link>
      </div>

      {err ? <p className="form-message">{err}</p> : null}
      {loading ? <div className="finance-skeleton finance-skeleton--metrics" aria-busy /> : null}

      {data && !loading ? (
        <>
          <div className="finance-metric-grid">
            <div className="finance-metric finance-metric--income">
              <p className="finance-metric__label">Total paid (all time)</p>
              <p className="finance-metric__value">{formatAcademyMoney(data.financial.overall.totalPaid, "RWF")}</p>
              <p className="finance-metric__hint">{data.financial.overall.totalInvoices} invoice rows</p>
            </div>
            <div className="finance-metric finance-metric--warn">
              <p className="finance-metric__label">Outstanding</p>
              <p className="finance-metric__value">{formatAcademyMoney(data.financial.overall.totalOutstanding, "RWF")}</p>
              <p className="finance-metric__hint">Unpaid invoice totals</p>
            </div>
            <div className="finance-metric finance-metric--neutral">
              <p className="finance-metric__label">Generated</p>
              <p className="finance-metric__value">{data.generatedAt.slice(0, 19).replace("T", " ")}</p>
              <p className="finance-metric__hint">Snapshot time (UTC)</p>
            </div>
          </div>

          <div className="card finance-panel">
            <h2 className="finance-panel__title">By age group</h2>
            <div className="admin-table-wrap">
              <table className="admin-table finance-table">
                <thead>
                  <tr>
                    <th>Group</th>
                    <th>Paid</th>
                    <th>Outstanding</th>
                    <th>Invoices</th>
                  </tr>
                </thead>
                <tbody>
                  {data.financial.byGroup.map((g) => (
                    <tr key={g.ageGroup}>
                      <td>{g.ageGroup}</td>
                      <td className="finance-num finance-num--pos">{formatAcademyMoney(g.paid, "RWF")}</td>
                      <td className="finance-num finance-num--neg">{formatAcademyMoney(g.outstanding, "RWF")}</td>
                      <td>{g.totalInvoices}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card finance-panel">
            <h2 className="finance-panel__title">Top payers (lifetime paid)</h2>
            <div className="admin-table-wrap">
              <table className="admin-table finance-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Group</th>
                    <th>Paid</th>
                    <th>Outstanding</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {topPlayers.map((p) => (
                    <tr key={p.playerId}>
                      <td>{p.playerName}</td>
                      <td>{p.ageGroup}</td>
                      <td className="finance-num finance-num--pos">{formatAcademyMoney(p.paid, "RWF")}</td>
                      <td className="finance-num finance-num--neg">{formatAcademyMoney(p.outstanding, "RWF")}</td>
                      <td>
                        <Link href={`/admin/players/${p.playerId}`} className="btn btn-secondary admin-btn-sm">
                          Profile
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
