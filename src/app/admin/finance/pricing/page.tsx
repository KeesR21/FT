"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { adminApiFetch, formatAdminApiMessage, parseAdminApiBody } from "@/lib/admin-api-fetch";
import { formatNetworkError } from "@/lib/api-error";
import { AGE_GROUPS } from "@/lib/age-groups";
import { SystemNotice } from "@/components/system/system-notice";
import { formatAcademyMoney } from "@/lib/finance-format";

type GroupFee = {
  group: string;
  amount: number;
  currency: string;
  updatedAt: string;
  updatedBy: string;
};

type RegistrationFeeVersion = {
  id: string;
  amount: number;
  currency: string;
  effectiveFrom: string;
  createdAt: string;
  createdBy: string;
  note?: string;
};

type PricingState = {
  defaultMonthlyFee: { amount: number; currency: string; updatedAt: string; updatedBy: string };
  groupFees: GroupFee[];
  registrationFees: RegistrationFeeVersion[];
};

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
    return d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso.slice(0, 10);
  }
}

function isoToDateInput(iso: string): string {
  return iso.slice(0, 10);
}

export default function FinancePricingPage() {
  const [pricing, setPricing] = useState<PricingState | null>(null);
  const [groupDrafts, setGroupDrafts] = useState<Record<string, string>>({});
  const [defaultDraft, setDefaultDraft] = useState<string>("");
  const [regAmount, setRegAmount] = useState<string>("");
  const [regEffective, setRegEffective] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [regNote, setRegNote] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string>("");
  const [err, setErr] = useState<string>("");

  const load = useCallback(async () => {
    try {
      const r = await adminApiFetch("/api/admin/pricing");
      if (!r.ok) {
        setErr(`Could not load pricing (${r.status}).`);
        return;
      }
      const data = (await r.json()) as { pricing: PricingState };
      setPricing(data.pricing);
      const drafts: Record<string, string> = {};
      for (const row of data.pricing.groupFees) drafts[row.group] = String(row.amount);
      setGroupDrafts(drafts);
      setDefaultDraft(String(data.pricing.defaultMonthlyFee.amount));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load pricing.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedGroups = useMemo(
    () => AGE_GROUPS.map((g) => pricing?.groupFees.find((row) => row.group === g)).filter((row): row is GroupFee => Boolean(row)),
    [pricing]
  );

  const activeRegistration = useMemo(() => {
    if (!pricing) return null;
    const now = new Date().toISOString();
    const eligible = [...pricing.registrationFees].filter((r) => r.effectiveFrom <= now);
    eligible.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
    return eligible[0] ?? pricing.registrationFees[pricing.registrationFees.length - 1] ?? null;
  }, [pricing]);

  const upcomingRegistration = useMemo(() => {
    if (!pricing) return [] as RegistrationFeeVersion[];
    const now = new Date().toISOString();
    return pricing.registrationFees.filter((r) => r.effectiveFrom > now).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  }, [pricing]);

  const historyRegistration = useMemo(() => {
    if (!pricing) return [] as RegistrationFeeVersion[];
    return [...pricing.registrationFees].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  }, [pricing]);

  async function postAction(body: Record<string, unknown>, busyKey: string) {
    setBusy(busyKey);
    setErr("");
    setNotice("");
    try {
      const r = await adminApiFetch("/api/admin/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const parsed = await parseAdminApiBody<Record<string, unknown>>(r);
      if (!parsed.ok) {
        setErr(parsed.message);
        return;
      }
      const data = parsed.data;
      setNotice(String(data?.message || "Updated."));
      const next = data?.pricing as PricingState | undefined;
      if (next) {
        setPricing(next);
        const drafts: Record<string, string> = {};
        for (const row of next.groupFees) drafts[row.group] = String(row.amount);
        setGroupDrafts(drafts);
        setDefaultDraft(String(next.defaultMonthlyFee.amount));
      }
    } catch (e) {
      setErr(formatNetworkError(e, "admin"));
    } finally {
      setBusy(null);
    }
  }

  function saveGroup(group: string) {
    const amount = Number(groupDrafts[group]);
    if (!Number.isFinite(amount) || amount <= 0) {
      setErr(`Enter a valid amount for ${group}.`);
      return;
    }
    void postAction({ action: "set-group-fee", group, amount }, `group:${group}`);
  }

  function saveDefault() {
    const amount = Number(defaultDraft);
    if (!Number.isFinite(amount) || amount <= 0) {
      setErr("Enter a valid default amount.");
      return;
    }
    void postAction({ action: "set-default-fee", amount }, "default");
  }

  function addRegistrationFee() {
    const amount = Number(regAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setErr("Enter a valid registration fee amount.");
      return;
    }
    if (!regEffective) {
      setErr("Choose an effective date.");
      return;
    }
    void postAction(
      {
        action: "add-registration-fee",
        amount,
        effectiveFrom: new Date(regEffective).toISOString(),
        note: regNote.trim() || undefined
      },
      "regfee"
    ).then(() => {
      setRegAmount("");
      setRegNote("");
    });
  }

  return (
    <section className="page-stack finance-page-stack" aria-label="Pricing">
      <header className="card finance-hero">
        <span className="k-pill">FINANCE</span>
        <h1 className="page-h1">Pricing</h1>
        <p className="page-lead muted">
          Set the monthly subscription fee per age group and manage registration fee versions. Group fees take effect
          immediately for newly generated invoices. Registration fee changes only apply to <strong>new applicants</strong>
          who register on or after the effective date — existing applicants keep the fee that was active when they applied.
        </p>
      </header>

      {err ? <SystemNotice variant="error">{err}</SystemNotice> : null}
      {notice ? <SystemNotice variant="success">{notice}</SystemNotice> : null}

      <div className="card finance-panel">
        <div className="finance-panel__head">
          <div>
            <h2 className="finance-panel__title">Monthly fee per age group</h2>
            <p className="finance-panel__meta muted">
              When admin generates a monthly invoice for a player, the amount comes from this group&apos;s row.
            </p>
          </div>
          {pricing ? (
            <p className="finance-panel__meta muted">
              Default fallback: <strong>{formatAcademyMoney(pricing.defaultMonthlyFee.amount, pricing.defaultMonthlyFee.currency)}</strong>{" "}
              · updated {formatDateTime(pricing.defaultMonthlyFee.updatedAt)}
            </p>
          ) : null}
        </div>

        {!pricing ? (
          <p className="muted">Loading pricing…</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table finance-table">
              <thead>
                <tr>
                  <th>Age group</th>
                  <th>Current monthly fee</th>
                  <th>New amount ({pricing.defaultMonthlyFee.currency})</th>
                  <th>Last updated</th>
                  <th className="finance-table__col--actions">Save</th>
                </tr>
              </thead>
              <tbody>
                {sortedGroups.map((row) => {
                  const draft = groupDrafts[row.group] ?? String(row.amount);
                  const dirty = Number(draft) !== Number(row.amount);
                  return (
                    <tr key={row.group}>
                      <td>
                        <strong>{row.group}</strong>
                      </td>
                      <td>
                        <span className="admin-pay-badge admin-pay-badge--blue">
                          {formatAcademyMoney(row.amount, row.currency)}
                        </span>
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          step={500}
                          className="input-field"
                          value={draft}
                          onChange={(e) => setGroupDrafts((prev) => ({ ...prev, [row.group]: e.target.value }))}
                          aria-label={`New monthly fee for ${row.group}`}
                        />
                      </td>
                      <td>
                        <span className="muted admin-cell-muted">{formatDateTime(row.updatedAt)}</span>
                        <div className="muted admin-cell-muted">{row.updatedBy}</div>
                      </td>
                      <td className="finance-table__col--actions">
                        <button
                          type="button"
                          className="btn ledger-action-btn"
                          disabled={!dirty || busy === `group:${row.group}`}
                          onClick={() => saveGroup(row.group)}
                          title={dirty ? "Save new fee for this group" : "No changes"}
                        >
                          {busy === `group:${row.group}` ? "Saving…" : "Save"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card finance-panel">
        <div className="finance-panel__head">
          <div>
            <h2 className="finance-panel__title">Default monthly fee</h2>
            <p className="finance-panel__meta muted">
              Fallback price used if a group has no override. New age groups automatically inherit this value.
            </p>
          </div>
        </div>
        {pricing ? (
          <div className="finance-eligible-panel__intro" style={{ alignItems: "flex-end" }}>
            <div style={{ display: "grid", gap: "0.35rem" }}>
              <label htmlFor="default-fee-input">New default amount ({pricing.defaultMonthlyFee.currency})</label>
              <input
                id="default-fee-input"
                type="number"
                min={0}
                step={500}
                className="input-field"
                value={defaultDraft}
                onChange={(e) => setDefaultDraft(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn ledger-action-btn"
              disabled={busy === "default" || Number(defaultDraft) === pricing.defaultMonthlyFee.amount}
              onClick={saveDefault}
            >
              {busy === "default" ? "Saving…" : "Save default"}
            </button>
          </div>
        ) : null}
      </div>

      <div className="card finance-panel">
        <div className="finance-panel__head">
          <div>
            <h2 className="finance-panel__title">Registration fee</h2>
            <p className="finance-panel__meta muted">
              Editing the registration fee adds a <strong>new version</strong>. The previous version stays in history and
              continues to apply to anyone who already registered. Pick an effective date in the future to schedule a
              price change.
            </p>
          </div>
          {activeRegistration ? (
            <p className="finance-panel__meta muted">
              Active fee:{" "}
              <strong>{formatAcademyMoney(activeRegistration.amount, activeRegistration.currency)}</strong> · effective{" "}
              {formatDateTime(activeRegistration.effectiveFrom)}
            </p>
          ) : null}
        </div>

        <div className="admin-table-wrap" style={{ marginBottom: "1.25rem" }}>
          <table className="admin-table finance-table">
            <thead>
              <tr>
                <th>Amount</th>
                <th>Effective from</th>
                <th>Created</th>
                <th>Note</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {historyRegistration.map((r) => {
                const isActive = activeRegistration?.id === r.id;
                const upcoming = upcomingRegistration.some((u) => u.id === r.id);
                return (
                  <tr key={r.id} className={isActive ? "admin-pay-row--attention" : undefined}>
                    <td>
                      <strong>{formatAcademyMoney(r.amount, r.currency)}</strong>
                    </td>
                    <td>{isoToDateInput(r.effectiveFrom)}</td>
                    <td>
                      <span className="muted admin-cell-muted">{formatDateTime(r.createdAt)}</span>
                      <div className="muted admin-cell-muted">{r.createdBy}</div>
                    </td>
                    <td>{r.note || <span className="muted">—</span>}</td>
                    <td>
                      {isActive ? (
                        <span className="admin-pay-badge admin-pay-badge--blue">Active</span>
                      ) : upcoming ? (
                        <span className="admin-pay-badge admin-pay-badge--orange">Scheduled</span>
                      ) : (
                        <span className="admin-pay-badge admin-pay-badge--muted">Historical</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="finance-eligible-panel__intro" style={{ alignItems: "flex-end", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ display: "grid", gap: "0.35rem", minWidth: 180 }}>
            <label htmlFor="reg-amount-input">New registration fee ({pricing?.defaultMonthlyFee.currency ?? "RWF"})</label>
            <input
              id="reg-amount-input"
              type="number"
              min={0}
              step={500}
              className="input-field"
              value={regAmount}
              onChange={(e) => setRegAmount(e.target.value)}
              placeholder="e.g. 50000"
            />
          </div>
          <div style={{ display: "grid", gap: "0.35rem", minWidth: 180 }}>
            <label htmlFor="reg-effective-input">Effective from</label>
            <input
              id="reg-effective-input"
              type="date"
              className="input-field"
              value={regEffective}
              onChange={(e) => setRegEffective(e.target.value)}
            />
          </div>
          <div style={{ display: "grid", gap: "0.35rem", flex: "1 1 220px" }}>
            <label htmlFor="reg-note-input">Note (optional)</label>
            <input
              id="reg-note-input"
              type="text"
              className="input-field"
              value={regNote}
              onChange={(e) => setRegNote(e.target.value)}
              maxLength={120}
              placeholder="e.g. Annual price adjustment"
            />
          </div>
          <button type="button" className="btn ledger-action-btn" disabled={busy === "regfee"} onClick={addRegistrationFee}>
            {busy === "regfee" ? "Saving…" : "Add new fee version"}
          </button>
        </div>
      </div>

      <DangerZoneCard onDone={(msg) => setNotice(msg)} onError={(msg) => setErr(msg)} />
    </section>
  );
}

function DangerZoneCard({
  onDone,
  onError
}: {
  onDone: (m: string) => void;
  onError: (m: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function wipe() {
    const typed = window.prompt(
      "This will permanently remove ALL players, parents, payments, messages, performance entries and invoice PDFs.\n\n" +
        "Timetable, CMS, and pricing are preserved.\n\n" +
        "Type WIPE to confirm:"
    );
    if (typed !== "WIPE") {
      onError("Wipe cancelled — confirmation text did not match.");
      return;
    }
    setBusy(true);
    try {
      const r = await adminApiFetch("/api/admin/dev/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "WIPE_ALL_PLAYERS" })
      });
      const json = (await r.json().catch(() => ({}))) as {
        message?: string;
        cleared?: { players?: number; parents?: number; payments?: number; invoicePdfs?: number };
      };
      if (!r.ok) {
        throw new Error(formatAdminApiMessage(r.status, json.message));
      }
      const c = json.cleared ?? {};
      onDone(
        `${json.message ?? "Wipe complete."} Cleared ${c.players ?? 0} players, ${c.parents ?? 0} parents, ${
          c.payments ?? 0
        } payments, ${c.invoicePdfs ?? 0} invoice PDFs.`
      );
    } catch (e) {
      onError(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card finance-panel" style={{ borderColor: "rgba(220,38,38,0.45)" }}>
      <div className="finance-panel__header">
        <div>
          <h2 className="finance-panel__title">Danger zone — reset test data</h2>
          <p className="muted finance-panel__lead">
            For testing only. Removes every player, parent, payment, message, performance entry and
            invoice PDF in one go. Timetable, CMS content, and the pricing settings on this page are
            kept intact. There is no undo.
          </p>
        </div>
      </div>
      <button
        type="button"
        className="btn admin-btn-sm finance-void-btn"
        disabled={busy}
        aria-busy={busy || undefined}
        onClick={() => void wipe()}
      >
        {busy ? "Wiping…" : "Wipe all players & payments"}
      </button>
    </div>
  );
}
