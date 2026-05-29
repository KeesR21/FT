"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApiFetch, readAdminApiError } from "@/lib/admin-api-fetch";
import { ACTIVITY_ACTIONS, type ActivityLogEntry } from "@/lib/activity-log-types";

const EMPTY_FILTERS = {
  action: "",
  actorId: "",
  resourceType: "",
  from: "",
  to: "",
  q: ""
};

export default function ActivityLogsPage() {
  const [items, setItems] = useState<ActivityLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(40);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [draft, setDraft] = useState({ ...EMPTY_FILTERS });
  const [applied, setApplied] = useState({ ...EMPTY_FILTERS });

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const sp = new URLSearchParams();
      sp.set("page", String(page));
      sp.set("pageSize", String(pageSize));
      if (applied.action.trim()) sp.set("action", applied.action.trim());
      if (applied.actorId.trim()) sp.set("actorId", applied.actorId.trim());
      if (applied.resourceType.trim()) sp.set("resourceType", applied.resourceType.trim());
      if (applied.from.trim()) sp.set("from", applied.from.trim());
      if (applied.to.trim()) sp.set("to", applied.to.trim());
      if (applied.q.trim()) sp.set("q", applied.q.trim());

      const r = await adminApiFetch(`/api/admin/activity-logs?${sp.toString()}`);
      if (!r.ok) throw new Error(await readAdminApiError(r));
      const d = (await r.json()) as { items: ActivityLogEntry[]; total: number; page: number };
      setItems(d.items);
      setTotal(d.total);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, applied]);

  useEffect(() => {
    void load();
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="admin-activity-logs page-stack">
      <header className="admin-activity-logs__head">
        <h1 className="admin-settings-title">Activity logs</h1>
        <p className="muted">
          Auditable trail of sign-ins, password events, kit and order changes, payments, roster edits, and registration
          decisions. Entries are stored on the server (file-backed in dev; configure durable storage in production).
        </p>
      </header>

      <section className="card admin-activity-logs__filters">
        <div className="admin-activity-logs__grid">
          <label className="form-label">
            <span>Search</span>
            <input
              className="input-field"
              value={draft.q}
              onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))}
              placeholder="Description, id…"
            />
          </label>
          <label className="form-label">
            <span>Action</span>
            <select className="input-field" value={draft.action} onChange={(e) => setDraft((d) => ({ ...d, action: e.target.value }))}>
              <option value="">Any</option>
              {ACTIVITY_ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="form-label">
            <span>Actor id / email</span>
            <input
              className="input-field"
              value={draft.actorId}
              onChange={(e) => setDraft((d) => ({ ...d, actorId: e.target.value }))}
              placeholder="parent id or email"
            />
          </label>
          <label className="form-label">
            <span>Resource type</span>
            <input
              className="input-field"
              value={draft.resourceType}
              onChange={(e) => setDraft((d) => ({ ...d, resourceType: e.target.value }))}
              placeholder="payment, kit_order, player…"
            />
          </label>
          <label className="form-label">
            <span>From (ISO date)</span>
            <input
              className="input-field"
              type="date"
              value={draft.from}
              onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
            />
          </label>
          <label className="form-label">
            <span>To (ISO date)</span>
            <input className="input-field" type="date" value={draft.to} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} />
          </label>
        </div>
        <div className="admin-activity-logs__filter-actions">
          <button
            type="button"
            className="btn"
            onClick={() => {
              setApplied({ ...draft });
              setPage(1);
            }}
            disabled={loading}
          >
            Apply filters
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setDraft({ ...EMPTY_FILTERS });
              setApplied({ ...EMPTY_FILTERS });
              setPage(1);
            }}
            disabled={loading}
          >
            Reset
          </button>
        </div>
      </section>

      {err ? (
        <p className="form-message" role="alert">
          {err}
        </p>
      ) : null}

      <section className="card admin-activity-logs__table-wrap">
        {loading ? (
          <p className="muted">Loading…</p>
        ) : items.length === 0 ? (
          <p className="muted">No entries match your filters.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table admin-activity-logs__table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Resource</th>
                  <th>Description</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <time dateTime={row.ts}>{new Date(row.ts).toLocaleString()}</time>
                    </td>
                    <td>
                      <code className="admin-activity-logs__code">{row.action}</code>
                    </td>
                    <td>
                      <div>{row.actorLabel ?? "—"}</div>
                      {row.actorId ? (
                        <div className="muted admin-activity-logs__sub">{row.actorId}</div>
                      ) : null}
                    </td>
                    <td>
                      {row.resourceType ? (
                        <>
                          <span>{row.resourceType}</span>
                          {row.resourceId ? (
                            <div className="muted admin-activity-logs__sub mono">{row.resourceId}</div>
                          ) : null}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={{ maxWidth: "22rem" }}>
                      <div>{row.description}</div>
                      {row.previousValue != null || row.newValue != null ? (
                        <details className="admin-activity-logs__diff">
                          <summary className="muted" style={{ cursor: "pointer", marginTop: "0.35rem" }}>
                            Before / after snapshot
                          </summary>
                          <div className="admin-activity-logs__diff-grid">
                            {row.previousValue != null ? (
                              <pre className="admin-activity-logs__diff-pre">{JSON.stringify(row.previousValue, null, 2)}</pre>
                            ) : null}
                            {row.newValue != null ? (
                              <pre className="admin-activity-logs__diff-pre">{JSON.stringify(row.newValue, null, 2)}</pre>
                            ) : null}
                          </div>
                        </details>
                      ) : null}
                    </td>
                    <td className="mono muted">{row.ip ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="admin-activity-logs__pager">
          <button type="button" className="btn btn-secondary" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span className="muted">
            Page {page} of {pages} · {total} entries
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={page >= pages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
}
