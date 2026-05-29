"use client";

import clsx from "clsx";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AGE_GROUPS } from "@/lib/age-groups";
import { ADMIN_OVERVIEW_REFRESH, type AdminOverviewRefreshDetail } from "@/lib/admin-client-events";
import { adminApiFetch, parseAdminApiBody, readAdminApiError } from "@/lib/admin-api-fetch";
import { useAdminOverviewRefresh } from "@/lib/use-admin-overview-refresh";
import {
  emptyRegistrationProfile,
  labelFoot,
  labelHowHeard,
  labelPosition,
  labelRelationship,
  mergeRegistrationProfile
} from "@/lib/registration-profile";
import { REGISTRATION_SELECT } from "@/lib/registration-schema";
import { MembershipBillingCards } from "@/components/admin/membership-billing-cards";
import { usePortalAuthNotify } from "@/components/portal/portal-auth-notify";
import {
  computeMembershipLifecyclePhase,
  daysSinceSubscriptionEnded,
  isPlayerInDanger,
  membershipPrimaryStatusLabel
} from "@/lib/membership-billing";
import { subscriptionStatusFromDate } from "@/lib/subscription-ui";
import type { Parent, Player, RegistrationProfile, RegistrationStatus, PlayerStatus } from "@/lib/types";

type PaymentRow = {
  id: string;
  paymentFor: string;
  amount: unknown;
  currency: string;
  dueDate: string;
  status: string;
  paidAt?: string;
};

function regFeePaid(payments: PaymentRow[]): boolean {
  return payments.some((p) => /registration fee/i.test(p.paymentFor) && p.status === "paid");
}

function badgeRegClass(s: RegistrationStatus): string {
  if (s === "pending") return "admin-badge admin-badge--warn";
  if (s === "approved") return "admin-badge admin-badge--success";
  return "admin-badge admin-badge--danger";
}

function badgeSubClass(s: string): string {
  if (s === "active") return "admin-badge admin-badge--success";
  if (s === "expiring_soon") return "admin-badge admin-badge--warn";
  if (s === "expired" || s === "ended") return "admin-badge admin-badge--danger";
  return "admin-badge admin-badge--muted";
}

export default function AdminPlayerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [player, setPlayer] = useState<Player | null>(null);
  const [parent, setParent] = useState<Parent | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [performance, setPerformance] = useState<Array<Record<string, unknown>>>([]);
  const [perfNotes, setPerfNotes] = useState("");
  const [perfFocus, setPerfFocus] = useState("");
  const [regProfile, setRegProfile] = useState<RegistrationProfile>(emptyRegistrationProfile);
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const notify = usePortalAuthNotify();

  const subscriptionUi = useMemo(
    () => (player ? subscriptionStatusFromDate(player.subscriptionValidUntil) : "ended"),
    [player]
  );

  const lifecyclePhase = useMemo(
    () => (player ? computeMembershipLifecyclePhase(player, payments) : "registration_fee_pending"),
    [player, payments]
  );

  const latestMembershipPayment = useMemo(
    () =>
      [...payments]
        .filter((p) => p.status === "paid" && p.paidAt && /\bmonthly\b|\bmembership\b/i.test(String(p.paymentFor)))
        .sort((a, b) => String(b.paidAt).localeCompare(String(a.paidAt)))[0],
    [payments]
  );
  const membershipStart = latestMembershipPayment?.paidAt
    ? String(latestMembershipPayment.paidAt).slice(0, 10)
    : "—";
  const membershipEnd = player?.subscriptionValidUntil ? String(player.subscriptionValidUntil).slice(0, 10) : "—";
  const admissionReady = regFeePaid(payments);

  const load = useCallback(async (detail?: AdminOverviewRefreshDetail) => {
    const silent = Boolean(detail?.silent);
    if (!silent) {
      setLoading(true);
      setErr("");
    }
    try {
      const r = await adminApiFetch(`/api/admin/players/${id}`);
      if (!r.ok) throw new Error(await readAdminApiError(r));
      const data = (await r.json()) as {
        player: Player;
        parent: Parent | null;
        payments?: PaymentRow[];
        performance?: Array<Record<string, unknown>>;
      };
      setPlayer(data.player);
      setParent(data.parent);
      setPayments(data.payments ?? []);
      setPerformance(data.performance ?? []);
      setRegProfile(mergeRegistrationProfile(data.player.registrationProfile, {}));
    } catch (e) {
      if (!silent) setErr(e instanceof Error ? e.message : "Load failed");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useAdminOverviewRefresh(load);

  async function saveAll() {
    if (!player || !parent) return;
    const emailTrim = parent.email.trim();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim);
    if (!emailOk) {
      notify.error("Enter a valid parent email address.", { duration: 7000 });
      return;
    }
    if (player.playerName.trim().length < 2) {
      notify.error("Player name must be at least 2 characters.", { duration: 6500 });
      return;
    }
    setSaveBusy(true);
    setErr("");
    try {
      const r = await adminApiFetch(`/api/admin/players/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerName: player.playerName.trim(),
          dateOfBirth: player.dateOfBirth,
          ageGroup: player.ageGroup,
          heightCm: player.heightCm,
          weightKg: player.weightKg,
          status: player.status,
          registrationStatus: player.registrationStatus,
          developmentNotes: player.developmentNotes ?? "",
          subscriptionValidUntil: player.subscriptionValidUntil ?? null,
          parentName: parent.parentName,
          phoneNumber: parent.phoneNumber,
          email: emailTrim,
          address: parent.address,
          registrationProfile: regProfile
        })
      });
      const parsed = await parseAdminApiBody<{ player?: Player }>(r);
      if (!parsed.ok) {
        notify.error(parsed.message, { duration: 8000 });
        return;
      }
      let nextPlayer = player;
      if (parsed.data.player) nextPlayer = parsed.data.player;
      setPlayer(nextPlayer);
      notify.success("Player details updated successfully.", { duration: 5000 });
      window.dispatchEvent(new Event(ADMIN_OVERVIEW_REFRESH));
      router.refresh();
    } finally {
      setSaveBusy(false);
    }
  }

  async function decideRegistration(status: "approved" | "rejected") {
    if (!player) return;
    setDecisionBusy(true);
    setErr("");
    try {
      const r = await adminApiFetch(`/api/registrations/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (!r.ok) {
        setErr(await readAdminApiError(r));
        return;
      }
      window.dispatchEvent(new Event(ADMIN_OVERVIEW_REFRESH));
      router.refresh();
    } finally {
      setDecisionBusy(false);
    }
  }

  async function withdraw() {
    if (!confirm("Mark this player as withdrawn? History is retained.")) return;
    const r = await adminApiFetch(`/api/admin/players/${id}/withdraw`, { method: "POST" });
    if (!r.ok) {
      setErr(await readAdminApiError(r));
      return;
    }
    window.dispatchEvent(new Event(ADMIN_OVERVIEW_REFRESH));
  }

  async function uploadPhoto(file: File) {
    setErr("");
    const fd = new FormData();
    fd.append("photo", file);
    const r = await adminApiFetch(`/api/admin/players/${id}/photo`, { method: "POST", body: fd });
    if (!r.ok) {
      setErr(await readAdminApiError(r));
      return;
    }
    window.dispatchEvent(new Event(ADMIN_OVERVIEW_REFRESH));
  }

  async function addPerformance() {
    if (!perfNotes.trim()) return;
    const r = await adminApiFetch(`/api/admin/performance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: id, notes: perfNotes, focusArea: perfFocus || undefined })
    });
    if (!r.ok) {
      setErr(await readAdminApiError(r));
      return;
    }
    setPerfNotes("");
    setPerfFocus("");
    window.dispatchEvent(new Event(ADMIN_OVERVIEW_REFRESH));
  }

  if (loading && !player) return <p className="muted">Loading…</p>;
  if (!player) return <p className="form-message">{err || "Not found"}</p>;

  const rs = player.registrationStatus;

  const isWithdrawn = player.status === "withdrawn";
  const inDanger = !isWithdrawn && isPlayerInDanger(player);
  const overdueDays = daysSinceSubscriptionEnded(player.subscriptionValidUntil);

  return (
    <div className="admin-profile-page">
      <header
        className={clsx(
          "admin-profile-hero card",
          isWithdrawn && "admin-profile-hero--withdrawn",
          inDanger && "admin-profile-hero--danger"
        )}
      >
        <div className="admin-profile-hero__top">
          <Link href="/admin/players" className="ks-text-link admin-quick-link">
            ← Roster
          </Link>
          <div className="admin-profile-hero__actions">
            <button type="button" className="btn" onClick={() => void saveAll()} disabled={!parent || saveBusy}>
              {saveBusy ? "Saving…" : "Save all changes"}
            </button>
          </div>
        </div>
        <div className="admin-profile-hero__main">
          <div className="admin-profile-identity">
            {player.profilePhotoUrl ? (
              <Image
                src={player.profilePhotoUrl}
                alt=""
                width={88}
                height={88}
                className="admin-profile-avatar"
                unoptimized
              />
            ) : (
              <div className="admin-profile-avatar admin-profile-avatar--placeholder" aria-hidden>
                {player.playerName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="admin-profile-title">{player.playerName}</h1>
              <p className="admin-profile-meta muted">
                Player ID <code className="admin-profile-id">{player.id}</code>
                {player.createdAt ? (
                  <>
                    {" "}
                    · Submitted <time dateTime={player.createdAt}>{player.createdAt.slice(0, 10)}</time>
                  </>
                ) : null}
              </p>
              <div className="admin-profile-badges">
                <span className={badgeRegClass(rs)}>Registration: {rs}</span>
                <span
                  className={`admin-badge ${player.status === "active" ? "admin-badge--success" : "admin-badge--danger"}`}
                >
                  {player.status}
                </span>
                <span className="admin-badge admin-badge--muted" title="Derived from registration + membership payments">
                  {membershipPrimaryStatusLabel(lifecyclePhase)}
                </span>
                {player.registrationStatus === "approved" && player.subscriptionValidUntil ? (
                  <span className={badgeSubClass(subscriptionUi)} title="Window end date">
                    Window: {subscriptionUi.replace("_", " ")}
                  </span>
                ) : null}
                <span className="admin-badge admin-badge--muted">Group {player.ageGroup}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {isWithdrawn ? (
        <div className="admin-withdrawn-banner" role="status">
          <span className="admin-withdrawn-banner__flag" aria-hidden>
            🚩
          </span>
          <strong>Withdrawn player</strong>
          <span>This player has left the academy. Roster history and payments stay on file.</span>
          {player.withdrawnAt ? (
            <time dateTime={player.withdrawnAt} style={{ opacity: 0.9 }}>
              Marked withdrawn {player.withdrawnAt.slice(0, 10)}
            </time>
          ) : null}
        </div>
      ) : null}

      {inDanger ? (
        <div className="admin-danger-banner" role="alert">
          <span className="admin-danger-banner__flag" aria-hidden>
            ⚠
          </span>
          <strong>Danger — payment overdue</strong>
          <span>
            Subscription ended {overdueDays} day{overdueDays === 1 ? "" : "s"} ago. Contact the parent and
            collect the renewal payment as soon as possible.
          </span>
        </div>
      ) : null}

      {err ? <p className="form-message">{err}</p> : null}

      <div className="admin-profile-grid">
        <div className="admin-profile-main page-stack">
          <MembershipBillingCards player={player} payments={payments} />

          <section className="card admin-profile-card">
            <div className="admin-profile-card__head">
              <h2 className="admin-profile-card__title">Registration intake</h2>
              <p className="admin-profile-card__lead muted">
                Data from the public form. Labels show how guardians answered; you can correct typos here.
              </p>
            </div>
            <div className="form-grid-responsive admin-form-grid--2">
              <label className="form-label">
                <span>Nationality</span>
                <input
                  className="input-field"
                  value={regProfile.nationality}
                  onChange={(e) => setRegProfile({ ...regProfile, nationality: e.target.value })}
                />
              </label>
              <label className="form-label">
                <span>Preferred position</span>
                <select
                  className="input-field"
                  value={regProfile.position}
                  onChange={(e) => setRegProfile({ ...regProfile, position: e.target.value })}
                >
                  <option value="">—</option>
                  {REGISTRATION_SELECT.position.map((v) => (
                    <option key={v} value={v}>
                      {labelPosition(v)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-label">
                <span>Preferred foot</span>
                <select
                  className="input-field"
                  value={regProfile.preferredFoot}
                  onChange={(e) => setRegProfile({ ...regProfile, preferredFoot: e.target.value })}
                >
                  <option value="">—</option>
                  {REGISTRATION_SELECT.preferredFoot.map((v) => (
                    <option key={v} value={v}>
                      {labelFoot(v)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-label">
                <span>Guardian relationship</span>
                <select
                  className="input-field"
                  value={regProfile.parentRelationship}
                  onChange={(e) => setRegProfile({ ...regProfile, parentRelationship: e.target.value })}
                >
                  <option value="">—</option>
                  {REGISTRATION_SELECT.parentRelationship.map((v) => (
                    <option key={v} value={v}>
                      {labelRelationship(v)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-label" style={{ gridColumn: "1 / -1" }}>
                <span>Previous club / academy</span>
                <input
                  className="input-field"
                  value={regProfile.previousClub}
                  onChange={(e) => setRegProfile({ ...regProfile, previousClub: e.target.value })}
                />
              </label>
              <label className="form-label">
                <span>Emergency contact name</span>
                <input
                  className="input-field"
                  value={regProfile.emergencyContactName}
                  onChange={(e) => setRegProfile({ ...regProfile, emergencyContactName: e.target.value })}
                />
              </label>
              <label className="form-label">
                <span>Emergency contact phone</span>
                <input
                  className="input-field"
                  value={regProfile.emergencyContactPhone}
                  onChange={(e) => setRegProfile({ ...regProfile, emergencyContactPhone: e.target.value })}
                />
              </label>
              <label className="form-label">
                <span>How they heard about us</span>
                <select
                  className="input-field"
                  value={regProfile.howHeard}
                  onChange={(e) => setRegProfile({ ...regProfile, howHeard: e.target.value })}
                >
                  <option value="">—</option>
                  {REGISTRATION_SELECT.howHeard.map((v) => (
                    <option key={v} value={v}>
                      {labelHowHeard(v)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-label" style={{ gridColumn: "1 / -1" }}>
                <span>Medical / allergies</span>
                <textarea
                  className="input-field"
                  rows={3}
                  value={regProfile.medicalInfo}
                  onChange={(e) => setRegProfile({ ...regProfile, medicalInfo: e.target.value })}
                />
              </label>
            </div>
          </section>

          <section className="card admin-profile-card">
            <div className="admin-profile-card__head">
              <h2 className="admin-profile-card__title">Academy record</h2>
              <p className="admin-profile-card__lead muted">Core roster fields, subscription end, and coaching notes.</p>
            </div>
            <div className="admin-player-photo-row">
              <label className="btn btn-secondary">
                Upload photo
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="visually-hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadPhoto(f);
                    e.target.value = "";
                  }}
                />
              </label>
              <p className="muted admin-cell-muted" style={{ margin: 0, flex: 1, minWidth: "12rem" }}>
                JPEG, PNG, or WebP · max 2.5 MB. Age group can follow date of birth when you save, unless you override.
              </p>
            </div>
            <div className="form-grid-responsive admin-form-grid--2">
              <label className="form-label">
                <span>Player name</span>
                <input
                  className="input-field"
                  value={player.playerName}
                  onChange={(e) => setPlayer({ ...player, playerName: e.target.value })}
                />
              </label>
              <label className="form-label">
                <span>Date of birth</span>
                <input
                  className="input-field"
                  type="date"
                  value={String(player.dateOfBirth ?? "").slice(0, 10)}
                  onChange={(e) => setPlayer({ ...player, dateOfBirth: e.target.value })}
                />
              </label>
              <label className="form-label">
                <span>Age group</span>
                <select
                  className="input-field"
                  value={player.ageGroup}
                  onChange={(e) => setPlayer({ ...player, ageGroup: e.target.value })}
                >
                  {AGE_GROUPS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-label">
                <span>Roster status</span>
                <select
                  className="input-field"
                  value={player.status}
                  onChange={(e) => setPlayer({ ...player, status: e.target.value as PlayerStatus })}
                >
                  <option value="active">active</option>
                  <option value="withdrawn">withdrawn</option>
                </select>
              </label>
              <label className="form-label">
                <span>Registration status</span>
                <select
                  className="input-field"
                  value={player.registrationStatus}
                  onChange={(e) =>
                    setPlayer({
                      ...player,
                      registrationStatus: e.target.value as RegistrationStatus
                    })
                  }
                >
                  <option value="pending">pending</option>
                  <option value="approved">approved</option>
                  <option value="rejected">rejected</option>
                </select>
              </label>
              <label className="form-label">
                <span>Height (cm)</span>
                <input
                  className="input-field"
                  type="number"
                  value={Number(player.heightCm)}
                  onChange={(e) => setPlayer({ ...player, heightCm: Number(e.target.value) })}
                />
              </label>
              <label className="form-label">
                <span>Weight (kg)</span>
                <input
                  className="input-field"
                  type="number"
                  value={Number(player.weightKg)}
                  onChange={(e) => setPlayer({ ...player, weightKg: Number(e.target.value) })}
                />
              </label>
              <label className="form-label">
                <span>Subscription valid until</span>
                <input
                  className="input-field"
                  type="datetime-local"
                  value={
                    player.subscriptionValidUntil ? String(player.subscriptionValidUntil).slice(0, 16) : ""
                  }
                  onChange={(e) =>
                    setPlayer({
                      ...player,
                      subscriptionValidUntil: e.target.value ? new Date(e.target.value).toISOString() : undefined
                    })
                  }
                />
              </label>
            </div>
            <label className="form-label" style={{ marginTop: "1rem" }}>
              <span>Development notes</span>
              <textarea
                className="input-field"
                rows={3}
                value={player.developmentNotes ?? ""}
                onChange={(e) => setPlayer({ ...player, developmentNotes: e.target.value })}
              />
            </label>
          </section>

          {parent ? (
            <section className="card admin-profile-card">
              <div className="admin-profile-card__head">
                <h2 className="admin-profile-card__title">Primary parent / guardian</h2>
                <p className="admin-profile-card__lead muted">Billing and day-to-day communications.</p>
              </div>
              <div className="form-grid-responsive admin-form-grid--2">
                <label className="form-label">
                  <span>Name</span>
                  <input
                    className="input-field"
                    value={parent.parentName}
                    onChange={(e) => setParent({ ...parent, parentName: e.target.value })}
                  />
                </label>
                <label className="form-label">
                  <span>Phone</span>
                  <input
                    className="input-field"
                    value={parent.phoneNumber}
                    onChange={(e) => setParent({ ...parent, phoneNumber: e.target.value })}
                  />
                </label>
                <label className="form-label">
                  <span>Email</span>
                  <input
                    className="input-field"
                    type="email"
                    value={parent.email}
                    onChange={(e) => setParent({ ...parent, email: e.target.value })}
                  />
                </label>
                <label className="form-label" style={{ gridColumn: "1 / -1" }}>
                  <span>Address</span>
                  <textarea
                    className="input-field"
                    rows={2}
                    value={parent.address}
                    onChange={(e) => setParent({ ...parent, address: e.target.value })}
                  />
                </label>
              </div>
            </section>
          ) : null}

          <section className="card admin-profile-card">
            <div className="admin-profile-card__head">
              <h2 className="admin-profile-card__title">Payments</h2>
              <p className="admin-profile-card__lead muted">
                Membership dates appear after a monthly fee is approved (1 month from that payment). Current window:{" "}
                {membershipStart} → {membershipEnd}
              </p>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>For</th>
                    <th>Amount</th>
                    <th>Due</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((py) => (
                    <tr key={String(py.id)}>
                      <td>{String(py.paymentFor)}</td>
                      <td>
                        {String(py.amount)} {String(py.currency)}
                      </td>
                      <td>{String(py.dueDate).slice(0, 10)}</td>
                      <td>{String(py.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted admin-cell-muted" style={{ marginTop: "0.75rem" }}>
              Confirm registration fee in{" "}
              <Link href="/admin/finance/approvals" className="ks-text-link">
                pending payments
              </Link>{" "}
              before approving admission.
            </p>
          </section>

          <section className="card admin-profile-card">
            <div className="admin-profile-card__head">
              <h2 className="admin-profile-card__title">Performance log</h2>
            </div>
            <ul className="muted admin-profile-perf-list">
              {performance.map((pe) => (
                <li key={String(pe.id)}>
                  <strong>{String(pe.date).slice(0, 10)}</strong> — {String(pe.notes)}
                  {pe.focusArea ? <span> ({String(pe.focusArea)})</span> : null}
                </li>
              ))}
            </ul>
            <div className="form-grid-responsive" style={{ marginTop: "1rem" }}>
              <label className="form-label">
                <span>New entry — notes</span>
                <textarea className="input-field" rows={2} value={perfNotes} onChange={(e) => setPerfNotes(e.target.value)} />
              </label>
              <label className="form-label">
                <span>Focus area (optional)</span>
                <input className="input-field" value={perfFocus} onChange={(e) => setPerfFocus(e.target.value)} />
              </label>
            </div>
            <button type="button" className="btn btn-secondary" style={{ marginTop: "0.75rem" }} onClick={() => void addPerformance()}>
              Add performance note
            </button>
          </section>

          <div className="admin-profile-footer-cta">
            <button type="button" className="btn" onClick={() => void saveAll()} disabled={!parent || saveBusy}>
              {saveBusy ? "Saving…" : "Save all changes"}
            </button>
            {player.status === "active" && player.registrationStatus === "approved" ? (
              <button type="button" className="btn btn-secondary" onClick={() => void withdraw()}>
                Withdraw player
              </button>
            ) : null}
          </div>
        </div>

        <aside className="admin-profile-aside page-stack">
          <section className="card admin-profile-card admin-profile-card--accent">
            <h2 className="admin-profile-card__title">Admission</h2>
            <p className="muted admin-profile-aside-note">
              {rs === "pending"
                ? admissionReady
                  ? "Registration fee is recorded as paid. You may approve this application."
                  : "Registration fee must be marked paid before the system allows approval."
                : rs === "approved"
                  ? "Player is admitted to the roster."
                  : "Application was declined."}
            </p>
            {rs === "pending" ? (
              <div className="admin-profile-aside-actions">
                <button
                  type="button"
                  className="btn"
                  disabled={decisionBusy || !admissionReady}
                  onClick={() => void decideRegistration("approved")}
                >
                  Approve admission
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={decisionBusy}
                  onClick={() => void decideRegistration("rejected")}
                >
                  Decline
                </button>
              </div>
            ) : null}
            {!admissionReady && rs === "pending" ? (
              <p className="form-message admin-profile-aside-warn">Awaiting paid registration fee.</p>
            ) : null}
          </section>

          <section className="card admin-profile-card">
            <h2 className="admin-profile-card__title">Intake summary</h2>
            <dl className="admin-profile-dl">
              <div>
                <dt>Position</dt>
                <dd>{labelPosition(regProfile.position)}</dd>
              </div>
              <div>
                <dt>Foot</dt>
                <dd>{labelFoot(regProfile.preferredFoot)}</dd>
              </div>
              <div>
                <dt>Nationality</dt>
                <dd>{regProfile.nationality || "—"}</dd>
              </div>
              <div>
                <dt>Emergency</dt>
                <dd>
                  {regProfile.emergencyContactName || "—"}
                  <br />
                  <span className="muted">{regProfile.emergencyContactPhone || ""}</span>
                </dd>
              </div>
            </dl>
          </section>

          <section className="card admin-profile-card">
            <h2 className="admin-profile-card__title">Shortcuts</h2>
            <ul className="admin-profile-shortcuts">
              <li>
                <Link href="/admin/communication" className="ks-text-link">
                  Send message
                </Link>
              </li>
              <li>
                <Link href="/admin/finance/transactions" className="ks-text-link">
                  All payments
                </Link>
              </li>
              <li>
                <Link href="/admin/applications" className="ks-text-link">
                  Applications hub
                </Link>
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
