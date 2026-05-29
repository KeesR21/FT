"use client";

import { useCallback, useEffect, useState } from "react";
import { ADMIN_OVERVIEW_REFRESH, type AdminOverviewRefreshDetail } from "@/lib/admin-client-events";
import { adminApiFetch, readAdminApiError } from "@/lib/admin-api-fetch";
import { useAdminOverviewRefresh } from "@/lib/use-admin-overview-refresh";
import { AGE_GROUPS } from "@/lib/age-groups";

type Msg = {
  id: string;
  createdAt: string;
  channel: string;
  ageGroup?: string;
  subject: string;
  body: string;
  sentBy: string;
};

export default function AdminCommunicationPage() {
  const [log, setLog] = useState<Msg[]>([]);
  const [channel, setChannel] = useState<"individual" | "group">("group");
  const [playerId, setPlayerId] = useState("");
  const [ageGroup, setAgeGroup] = useState("U9");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [alsoEmail, setAlsoEmail] = useState(false);
  const [players, setPlayers] = useState<Array<{ id: string; playerName: string }>>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const loadLog = useCallback(async (detail?: AdminOverviewRefreshDetail) => {
    const silent = Boolean(detail?.silent);
    try {
      const r = await adminApiFetch("/api/admin/messages");
      if (!r.ok) throw new Error(await readAdminApiError(r));
      const data = await r.json();
      setLog(data.messages);
    } catch (e) {
      if (!silent) setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPlayers = useCallback(async () => {
    try {
      const r = await adminApiFetch("/api/admin/players?registration=approved&withdrawn=0");
      if (!r.ok) return;
      const data = await r.json();
      setPlayers(data.players.map((p: { id: string; playerName: string }) => ({ id: p.id, playerName: p.playerName })));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadLog();
    loadPlayers();
  }, [loadLog, loadPlayers]);

  useAdminOverviewRefresh((detail) => {
    void loadLog(detail);
    void loadPlayers();
  });

  async function send() {
    setErr("");
    try {
      const r = await adminApiFetch("/api/admin/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          playerId: channel === "individual" ? playerId : undefined,
          ageGroup: channel === "group" ? ageGroup : undefined,
          subject,
          body,
          alsoEmail
        })
      });
      if (!r.ok) throw new Error(await readAdminApiError(r));
      setSubject("");
      setBody("");
      window.dispatchEvent(new Event(ADMIN_OVERVIEW_REFRESH));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Send failed");
    }
  }

  return (
    <section className="page-stack">
      <div className="card page-hero-card">
        <span className="k-pill">COMMS</span>
        <h1 className="page-h1">Communication</h1>
        <p className="page-lead muted">
          Log internal messages and optionally email parents (when Resend is configured). Group sends target all active players in an age band.
        </p>
      </div>

      <div className="card">
        <h2>Compose</h2>
        {err ? <p className="form-message">{err}</p> : null}
        <div className="form-grid-responsive admin-form-grid--2">
          <label className="form-label">
            <span>Channel</span>
            <select className="input-field" value={channel} onChange={(e) => setChannel(e.target.value as "individual" | "group")}>
              <option value="group">Group (age band)</option>
              <option value="individual">Individual (by player)</option>
            </select>
          </label>
          {channel === "group" ? (
            <label className="form-label">
              <span>Age group</span>
              <select className="input-field" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)}>
                {AGE_GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="form-label">
              <span>Player</span>
              <select className="input-field" value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
                <option value="">Select…</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.playerName}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="form-label" style={{ gridColumn: "1 / -1" }}>
            <span>Subject</span>
            <input className="input-field" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <label className="form-label" style={{ gridColumn: "1 / -1" }}>
            <span>Message</span>
            <textarea className="input-field" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
          </label>
          <label className="form-label admin-filter-checkbox">
            <input type="checkbox" checked={alsoEmail} onChange={(e) => setAlsoEmail(e.target.checked)} />
            <span>Also send email (if configured)</span>
          </label>
        </div>
        <button type="button" className="btn" onClick={send}>
          Send & log
        </button>
      </div>

      <div className="card">
        <h2>Message log</h2>
        {loading ? <p className="muted">Loading…</p> : null}
        <ul className="muted" style={{ listStyle: "none", padding: 0 }}>
          {log.map((m) => (
            <li key={m.id} className="card" style={{ marginBottom: "0.75rem", padding: "1rem" }}>
              <strong>{m.subject}</strong>{" "}
              <span className="admin-badge admin-badge--muted">{m.channel}</span>
              {m.ageGroup ? <span className="admin-cell-muted"> · {m.ageGroup}</span> : null}
              <p style={{ margin: "0.5rem 0 0", whiteSpace: "pre-wrap" }}>{m.body}</p>
              <p className="admin-cell-muted" style={{ margin: "0.5rem 0 0" }}>
                {new Date(m.createdAt).toLocaleString()} · {m.sentBy}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
