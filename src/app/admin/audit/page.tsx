"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { adminApiFetch } from "@/lib/admin-api-fetch";
import { AUDIT_MODULE_IDS, type AuditModuleId, type AuditRunResult } from "@/lib/audit/types";

type HistoryItem = {
  id: string;
  finishedAt: string;
  durationMs: number;
  modulesRun: AuditModuleId[];
  summary: { total: number; bySeverity: Record<string, number> };
  error?: string;
  pdfRelativePath: string | null;
};

const MODULE_LABEL: Record<AuditModuleId, string> = {
  all: "All modules",
  functional: "Functional & logic",
  api: "API & backend",
  database: "Database",
  security: "Security",
  performance: "Performance",
  ux: "UI / UX",
  consistency: "Data consistency"
};

function severityChips(s: { total: number; bySeverity: Record<string, number> }) {
  return (
    <span className="admin-audit-sev">
      {s.total === 0 ? (
        <span className="admin-badge admin-badge--muted">0 findings</span>
      ) : (
        Object.entries(s.bySeverity)
          .filter(([, n]) => n > 0)
          .map(([k, n]) => (
            <span key={k} className="admin-audit-sev__item" data-sev={k}>
              {k} {n}
            </span>
          ))
      )}
    </span>
  );
}

export default function SystemAuditPage() {
  const [sel, setSel] = useState<Set<AuditModuleId>>(
    () => new Set([...AUDIT_MODULE_IDS, "all" as AuditModuleId])
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [last, setLast] = useState<AuditRunResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const loadHistory = useCallback(async () => {
    const r = await adminApiFetch("/api/admin/audit");
    if (!r.ok) return;
    const d = await r.json();
    setHistory(d.history ?? []);
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const allSelected = sel.has("all") || [...AUDIT_MODULE_IDS].every((m) => sel.has(m));

  const toggle = (m: AuditModuleId) => {
    setSel((prev) => {
      const n = new Set(prev);
      if (m === "all") {
        if (n.has("all")) {
          n.clear();
        } else {
          n.add("all");
          for (const x of AUDIT_MODULE_IDS) n.add(x);
        }
        return n;
      }
      if (n.has("all")) n.delete("all");
      if (n.has(m)) n.delete(m);
      else n.add(m);
      if ([...AUDIT_MODULE_IDS].every((x) => n.has(x))) n.add("all" as AuditModuleId);
      return n;
    });
  };

  const run = async () => {
    setBusy(true);
    setErr("");
    setMsg("");
    setLast(null);
    try {
      const modules: AuditModuleId[] = allSelected ? [] : Array.from(sel).filter((m) => m !== "all");
      const r = await adminApiFetch("/api/admin/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modules: allSelected || modules.length === 0 ? undefined : modules })
      });
      const t = await r.text();
      if (!r.ok) {
        setErr(t || "Audit failed");
        return;
      }
      const data = JSON.parse(t) as { result: AuditRunResult & { storedId?: string } };
      setLast(data.result);
      if (data.result.error) {
        setMsg("Audit completed with errors (see result).");
      } else {
        setMsg("Audit complete. You can download the PDF report below.");
      }
      await loadHistory();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="page-stack">
      <div className="card page-hero-card">
        <span className="k-pill">OPERATIONS</span>
        <h1 className="page-h1">Technical audit</h1>
        <p className="page-lead muted" style={{ maxWidth: "42rem" }}>
          Run static and lightweight checks (security, API surface, database, key modules, performance and UX
          heuristics). Download a professional PDF; pair with <code>npm test</code> and manual QA for full coverage.
        </p>
      </div>

      <div className="card admin-audit">
        <h2 style={{ marginTop: 0, fontSize: "1.15rem", fontWeight: 700 }}>Run scan</h2>
        <p className="muted" style={{ marginBottom: "1rem" }}>
          Leave &quot;All modules&quot; checked or pick specific areas. A full scan may take a minute on large codebases.
        </p>

        <div className="admin-audit-modules">
          <label className="admin-audit-mod">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => {
                if (allSelected) setSel(new Set());
                else {
                  setSel(new Set([...AUDIT_MODULE_IDS, "all" as AuditModuleId]));
                }
              }}
            />
            <span>All modules</span>
          </label>
          {([...AUDIT_MODULE_IDS] as const).map((m) => (
            <label key={m} className="admin-audit-mod">
              <input
                type="checkbox"
                checked={sel.has(m) || allSelected}
                onChange={() => toggle(m)}
                disabled={allSelected}
              />
              <span>{MODULE_LABEL[m]}</span>
            </label>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3" style={{ marginTop: "0.5rem" }}>
          <button type="button" className="btn" onClick={run} disabled={busy || (!allSelected && sel.size === 0)}>
            {busy ? "Running audit…" : "Run audit"}
          </button>
        </div>

        {err ? (
          <p className="muted" style={{ color: "var(--err)", marginTop: "0.75rem" }} role="alert">
            {err}
          </p>
        ) : null}
        {msg ? <p className="muted" style={{ marginTop: "0.75rem" }}>{msg}</p> : null}

        {last && (
          <div className="admin-audit-report" style={{ marginTop: "1.5rem" }}>
            <h3 style={{ marginTop: 0, fontSize: "1rem", fontWeight: 700 }}>Latest result</h3>
            <p className="text-sm text-muted">
              Duration: {(last.durationMs / 1000).toFixed(1)}s · Issues: {last.summary.total}
            </p>
            <div className="mt-2 mb-2">{severityChips(last.summary)}</div>
            {last.error ? <p className="text-amber-700 text-sm">Runner error: {last.error}</p> : null}
            {last.pdfUrl ? (
              <p style={{ marginTop: "0.5rem" }}>
                <Link className="u-link" href={last.pdfUrl} target="_blank" rel="noreferrer">
                  Download PDF report
                </Link>
              </p>
            ) : (
              <p className="muted" style={{ marginTop: "0.5rem", fontSize: "0.875rem" }}>
                No PDF (run failed before generation).
              </p>
            )}
            <details style={{ marginTop: "1rem" }}>
              <summary className="cursor-pointer" style={{ fontSize: "0.9rem" }}>
                View raw findings ({last.issues.length})
              </summary>
              <ul className="list-disc pl-5 text-sm max-h-80 overflow-y-auto" style={{ marginTop: "0.5rem" }}>
                {last.issues.map((i) => (
                  <li key={i.id} className="mb-2">
                    <span className="font-semibold">[{i.severity}]</span> {i.title}
                    {i.affectedPath ? <span className="text-muted"> — {i.affectedPath}</span> : null}
                  </li>
                ))}
              </ul>
            </details>
          </div>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0, fontSize: "1.15rem", fontWeight: 700 }}>Past audits</h2>
        {history.length === 0 ? (
          <p className="muted">No previous runs stored in this environment.</p>
        ) : (
          <ul className="admin-audit-history" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {history.map((h) => (
              <li
                key={h.id}
                className="admin-audit-history__row"
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.5rem 1rem",
                  padding: "0.65rem 0",
                  borderBottom: "1px solid var(--border, #e5e7eb)"
                }}
              >
                <div>
                  <span className="font-mono text-xs muted">{h.id.slice(0, 8)}…</span>
                  <span className="ml-2 text-sm">{new Date(h.finishedAt).toLocaleString()}</span>
                </div>
                <div style={{ flex: "1 1 12rem" }}>{severityChips(h.summary)}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  {h.error ? <span style={{ color: "var(--warn, #b45309)", fontSize: "0.75rem" }}>Error</span> : null}
                  {h.pdfRelativePath ? (
                    <Link className="u-link" href={h.pdfRelativePath} target="_blank" rel="noreferrer">
                      PDF
                    </Link>
                  ) : (
                    <span className="text-xs muted">—</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
