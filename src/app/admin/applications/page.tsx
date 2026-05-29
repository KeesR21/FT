"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ADMIN_OVERVIEW_REFRESH, type AdminOverviewRefreshDetail } from "@/lib/admin-client-events";
import { adminApiFetch, readAdminApiError } from "@/lib/admin-api-fetch";
import { SystemNotice } from "@/components/system/system-notice";
import { useAdminOverviewRefresh } from "@/lib/use-admin-overview-refresh";
import type { RegistrationProfile, RegistrationStatus } from "@/lib/types";

type PaymentLite = { paymentFor: string; status: string; paidAt?: string | null };

type Row = {
  id: string;
  playerName: string;
  dateOfBirth?: string;
  ageGroup: string;
  registrationStatus: RegistrationStatus;
  createdAt?: string;
  registrationProfile?: RegistrationProfile;
  parent?: { parentName: string; email: string; phoneNumber: string } | null;
  payments?: PaymentLite[];
  playerDanger?: boolean;
};

function paidRegistration(payments: PaymentLite[] | undefined): PaymentLite | null {
  if (!payments?.length) return null;
  return (
    payments.find((p) => /registration fee/i.test(p.paymentFor) && p.status === "paid") ?? null
  );
}

async function readApiError(r: Response): Promise<string> {
  return readAdminApiError(r);
}

type Tab = "pending" | "approved" | "rejected" | "all";

export default function AdminApplicationsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState<Tab>("pending");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const inFlightRef = useRef<Set<string>>(new Set());

  const load = useCallback(async (detail?: AdminOverviewRefreshDetail) => {
    const silent = Boolean(detail?.silent);
    if (!silent) {
      setLoading(true);
      setErr("");
    }
    try {
      const r = await adminApiFetch(`/api/admin/players?registration=all`);
      if (!r.ok) throw new Error(await readApiError(r));
      const data = await r.json();
      setRows(data.players);
    } catch (e) {
      if (!silent) setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useAdminOverviewRefresh(load);

  const filtered = useMemo(() => {
    if (tab === "all") return rows;
    return rows.filter((p) => p.registrationStatus === tab);
  }, [rows, tab]);

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0, all: rows.length };
    for (const p of rows) {
      if (p.registrationStatus === "pending") c.pending += 1;
      else if (p.registrationStatus === "approved") c.approved += 1;
      else c.rejected += 1;
    }
    return c;
  }, [rows]);

  async function decide(id: string, status: "approved" | "rejected") {
    if (inFlightRef.current.has(id)) return;
    inFlightRef.current.add(id);
    setBusy(id);
    setErr("");
    setNotice("");
    try {
      const r = await adminApiFetch(`/api/registrations/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (!r.ok) throw new Error(await readApiError(r));
      const json = (await r.json().catch(() => ({}))) as { message?: string };
      const msg =
        json.message ??
        (status === "approved"
          ? "Player admitted. Monthly invoice now waiting for the parent to pay."
          : "Application declined.");
      setNotice(msg);
      window.dispatchEvent(new Event(ADMIN_OVERVIEW_REFRESH));
      router.refresh();
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      inFlightRef.current.delete(id);
      setBusy(null);
    }
  }

  return (
    <section className="page-stack">
      <div className="card page-hero-card">
        <span className="k-pill">APPLICATIONS</span>
        <h1 className="page-h1">Applications &amp; admissions</h1>
        <p className="page-lead muted">
          Every registration lives on the player record — pending, admitted, or declined. The application fee
          must be confirmed before you can admit. Admitting a player automatically generates the first monthly
          membership invoice for the parent.
        </p>
      </div>

      <div className="card">
        {err ? (
          <SystemNotice variant="error" title="Action failed">
            {err}
          </SystemNotice>
        ) : null}
        {notice ? (
          <SystemNotice variant="success" title="Done">
            {notice}
          </SystemNotice>
        ) : null}

        <div className="admin-applications-tabs" role="tablist" aria-label="Application status">
          {(
            [
              ["pending", "Pending"],
              ["approved", "Admitted"],
              ["rejected", "Declined"],
              ["all", "All"]
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
              {key !== "all" ? ` (${counts[key]})` : ` (${counts.all})`}
            </button>
          ))}
        </div>

        {loading ? <p className="muted">Loading…</p> : null}
        {!loading && filtered.length === 0 ? (
          <p className="muted">No applications in this view.</p>
        ) : null}

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Submitted</th>
                <th>Player</th>
                <th>Group</th>
                <th>Nationality</th>
                <th>Parent</th>
                <th>Reg. fee</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const paid = paidRegistration(p.payments);
                const nat = p.registrationProfile?.nationality?.trim() || "—";
                const submitted = p.createdAt ? p.createdAt.slice(0, 10) : "—";
                const isBusy = busy === p.id;
                return (
                  <tr key={p.id} className={p.playerDanger ? "admin-pay-row--danger" : undefined}>
                    <td className="muted admin-cell-muted">{submitted}</td>
                    <td>
                      <div className="admin-table-cell-player">
                        <strong>{p.playerName}</strong>
                        {p.playerDanger ? <span className="admin-danger-flag">DANGER</span> : null}
                      </div>
                      <span className="muted admin-cell-muted">DOB {p.dateOfBirth?.slice(0, 10) ?? "—"}</span>
                    </td>
                    <td>{p.ageGroup}</td>
                    <td>{nat}</td>
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
                      <span className={`admin-badge ${paid ? "admin-badge--success" : "admin-badge--warn"}`}>
                        {paid ? "Paid" : "Unpaid"}
                      </span>
                      {paid?.paidAt ? (
                        <div className="muted admin-cell-muted" style={{ marginTop: "0.2rem" }}>
                          on {paid.paidAt.slice(0, 10)}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <span
                        className={`admin-badge ${
                          p.registrationStatus === "pending"
                            ? "admin-badge--warn"
                            : p.registrationStatus === "approved"
                              ? "admin-badge--success"
                              : "admin-badge--danger"
                        }`}
                      >
                        {p.registrationStatus}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}>
                        <Link href={`/admin/players/${p.id}`} className="btn btn-secondary admin-btn-sm">
                          Profile
                        </Link>
                        {p.registrationStatus === "pending" ? (
                          <>
                            <button
                              type="button"
                              className="btn admin-btn-sm"
                              disabled={isBusy || !paid}
                              aria-busy={isBusy || undefined}
                              title={
                                !paid
                                  ? "Application fee must be paid first."
                                  : "Admit player and start monthly membership billing."
                              }
                              onClick={() => decide(p.id, "approved")}
                            >
                              {isBusy ? "Working…" : "Admit player"}
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary admin-btn-sm"
                              disabled={isBusy}
                              aria-busy={isBusy || undefined}
                              onClick={() => decide(p.id, "rejected")}
                            >
                              Decline
                            </button>
                          </>
                        ) : null}
                      </div>
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
