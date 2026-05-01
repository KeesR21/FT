"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ADMIN_OVERVIEW_REFRESH } from "@/lib/admin-client-events";
import { adminApiFetch } from "@/lib/admin-api-fetch";
import { useAdminOverviewRefresh } from "@/lib/use-admin-overview-refresh";
import type { RegistrationProfile, RegistrationStatus } from "@/lib/types";

type PaymentLite = { paymentFor: string; status: string };

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
};

function regFeePaid(payments: PaymentLite[] | undefined): boolean {
  if (!payments?.length) return false;
  return payments.some((p) => /registration fee/i.test(p.paymentFor) && p.status === "paid");
}

async function readApiError(r: Response): Promise<string> {
  const t = await r.text();
  try {
    const j = JSON.parse(t) as { message?: string };
    if (j && typeof j.message === "string" && j.message) return j.message;
  } catch {
    /* plain text */
  }
  return t || r.statusText || "Request failed";
}

type Tab = "pending" | "approved" | "rejected" | "all";

export default function AdminApplicationsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState<Tab>("pending");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const r = await adminApiFetch(`/api/admin/players?registration=all`);
      if (!r.ok) throw new Error(await readApiError(r));
      const data = await r.json();
      setRows(data.players);
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
    setBusy(id);
    setErr("");
    try {
      const r = await adminApiFetch(`/api/registrations/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (!r.ok) throw new Error(await readApiError(r));
      window.dispatchEvent(new Event(ADMIN_OVERVIEW_REFRESH));
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="page-stack">
      <div className="card page-hero-card">
        <span className="k-pill">APPLICATIONS</span>
        <h1 className="page-h1">Applications &amp; admissions</h1>
        <p className="page-lead muted">
          Every registration lives on the player record — pending, admitted, or declined. Open a profile to view or
          edit the full intake, parent contacts, and payments. Admission requires a paid registration fee.
        </p>
      </div>

      <div className="card">
        {err ? <p className="form-message">{err}</p> : null}

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
                const paid = regFeePaid(p.payments);
                const nat = p.registrationProfile?.nationality?.trim() || "—";
                const submitted = p.createdAt ? p.createdAt.slice(0, 10) : "—";
                return (
                  <tr key={p.id}>
                    <td className="muted admin-cell-muted">{submitted}</td>
                    <td>
                      <strong>{p.playerName}</strong>
                      <br />
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
                              disabled={busy === p.id || !paid}
                              title={!paid ? "Registration fee must be paid first" : undefined}
                              onClick={() => decide(p.id, "approved")}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary admin-btn-sm"
                              disabled={busy === p.id}
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
