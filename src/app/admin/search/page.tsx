"use client";

import clsx from "clsx";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { adminApiFetch, readAdminApiError } from "@/lib/admin-api-fetch";
import type { AdminOverviewRefreshDetail } from "@/lib/admin-client-events";
import { useAdminOverviewRefresh } from "@/lib/use-admin-overview-refresh";

type Hit = {
  id: string;
  playerName: string;
  ageGroup: string;
  registrationStatus: string;
  status: string;
  parent?: { parentName: string; email: string } | null;
  playerDanger?: boolean;
  playerOverdueDays?: number;
};

export default function AdminSearchPage() {
  const [q, setQ] = useState("");
  const [players, setPlayers] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const run = useCallback(async (query: string, detail?: AdminOverviewRefreshDetail) => {
    if (query.trim().length < 2) {
      setPlayers([]);
      return;
    }
    const silent = Boolean(detail?.silent);
    if (!silent) {
      setLoading(true);
      setErr("");
    }
    try {
      const r = await adminApiFetch(`/api/admin/search?q=${encodeURIComponent(query.trim())}`);
      if (!r.ok) throw new Error(await readAdminApiError(r));
      const d = await r.json();
      setPlayers(d.players ?? []);
    } catch (e) {
      if (!silent) {
        setErr(e instanceof Error ? e.message : "Search failed");
        setPlayers([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const iq = params.get("q") ?? "";
    setQ(iq);
    if (iq.length >= 2) run(iq);
  }, [run]);

  useAdminOverviewRefresh(
    useCallback(
      (detail) => {
        if (q.trim().length >= 2) void run(q, detail);
      },
      [q, run]
    )
  );

  return (
    <section className="page-stack">
      <div className="card page-hero-card">
        <span className="k-pill">SEARCH</span>
        <h1 className="page-h1">Find players &amp; parents</h1>
        <p className="page-lead muted">Type at least 2 characters. Matches player name, parent name, email, or phone.</p>
      </div>

      <div className="card">
        <form
          className="admin-filters"
          onSubmit={(e) => {
            e.preventDefault();
            const params = new URLSearchParams();
            params.set("q", q);
            window.history.replaceState(null, "", `/admin/search?${params.toString()}`);
            run(q);
          }}
        >
          <label className="form-label" style={{ flex: 1, minWidth: "200px" }}>
            <span>Query</span>
            <input className="input-field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or email…" />
          </label>
          <button type="submit" className="btn">
            Search
          </button>
        </form>
        {err ? <p className="form-message">{err}</p> : null}
        {loading ? <p className="muted">Searching…</p> : null}
        {!loading && q.trim().length >= 2 && players.length === 0 ? <p className="muted">No matches.</p> : null}

        <div className="admin-table-wrap" style={{ marginTop: "1rem" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Group</th>
                <th>Reg.</th>
                <th>Status</th>
                <th>Parent</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {players.map((p) => {
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
                      {isWithdrawn ? <span className="admin-withdrawn-pill">Withdrawn</span> : null}
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
                  <td>{p.registrationStatus}</td>
                  <td>
                    <span className={clsx("admin-badge", isWithdrawn ? "admin-badge--danger" : "admin-badge--muted")}>
                      {p.status}
                    </span>
                  </td>
                  <td className="admin-cell-muted">
                    {p.parent ? (
                      <>
                        {p.parent.parentName}
                        <br />
                        {p.parent.email}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <Link href={`/admin/players/${p.id}`} className="ks-text-link admin-quick-link">
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
