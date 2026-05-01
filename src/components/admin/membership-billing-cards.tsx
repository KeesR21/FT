"use client";

import {
  computeMembershipLifecyclePhase,
  membershipDaysRemaining,
  membershipEndedMessage,
  membershipPrimaryStatusLabel,
  registrationFeeUiStatus
} from "@/lib/membership-billing";
import type { Player } from "@/lib/types";

type PaymentMin = { paymentFor: string; status: string; paidAt?: string };

function badgeClass(reg: "pending" | "paid") {
  return reg === "paid" ? "membership-card__badge membership-card__badge--paid" : "membership-card__badge membership-card__badge--pending";
}

export function MembershipBillingCards({ player, payments }: { player: Player; payments: PaymentMin[] }) {
  const phase = computeMembershipLifecyclePhase(player, payments);
  const regUi = registrationFeeUiStatus(payments);
  const days = membershipDaysRemaining(player);
  const endStr = player.subscriptionValidUntil ? String(player.subscriptionValidUntil).slice(0, 10) : null;
  const latestMonthly = [...payments]
    .filter((p) => p.status === "paid" && /\bmonthly\b|\bmembership\b/i.test(p.paymentFor) && p.paidAt)
    .sort((a, b) => String(b.paidAt).localeCompare(String(a.paidAt)))[0];
  const startStr = latestMonthly?.paidAt ? String(latestMonthly.paidAt).slice(0, 10) : null;

  const cards = [
    {
      key: "reg",
      tone: "blue" as const,
      title: "Registration fee",
      desc: "One-time fee to apply. Paying it does not start the monthly player membership.",
      badge: regUi === "paid" ? "Paid" : "Pending",
      badgeClass: badgeClass(regUi),
      active: true
    },
    {
      key: "approval",
      tone: "yellow" as const,
      title: "Player status",
      desc:
        phase === "rejected"
          ? "This application was declined. Registration fee handling follows your finance policy."
          : phase === "applicant_registration_paid"
            ? "Registration fee received — the club is still reviewing the application."
            : phase === "active_membership_unpaid"
              ? "Player is admitted — the monthly membership has not started until that fee is paid and recorded."
              : "Shows where the player is between application, admission, and monthly membership.",
      badge:
        phase === "rejected"
          ? "Rejected"
          : phase === "applicant_registration_paid"
            ? "Applicant"
            : phase === "active_membership_unpaid"
              ? "Active · unpaid"
              : player.registrationStatus === "approved"
                ? "Admitted"
                : player.registrationStatus === "pending"
                  ? "Pending review"
                  : "—",
      badgeClass: "membership-card__badge membership-card__badge--neutral",
      active: phase === "applicant_registration_paid" || phase === "active_membership_unpaid" || phase === "rejected"
    },
    {
      key: "active",
      tone: "green" as const,
      title: "Monthly membership",
      desc: "Starts after the first monthly fee is recorded as paid. Each payment covers about one month from its payment date.",
      badge: phase === "membership_active" ? "Active" : "Not active",
      badgeClass:
        phase === "membership_active"
          ? "membership-card__badge membership-card__badge--ok"
          : "membership-card__badge membership-card__badge--muted",
      active: phase === "membership_active",
      lines: startStr && endStr ? [
        { k: "Start", v: startStr },
        { k: "Expires", v: endStr }
      ] : endStr
        ? [{ k: "Expires", v: endStr }]
        : undefined
    },
    {
      key: "expiring",
      tone: "orange" as const,
      title: "Membership expiring soon",
      desc: "The current monthly period is almost over — follow up so access stays uninterrupted.",
      badge: "Expiring",
      badgeClass: "membership-card__badge membership-card__badge--warn",
      active: phase === "membership_expiring_soon",
      lines: typeof days === "number" ? [{ k: "Days until period ends", v: String(days) }] : undefined
    },
    {
      key: "expired",
      tone: "red" as const,
      title: "Membership expired",
      desc: membershipEndedMessage(player.subscriptionValidUntil),
      badge: "Expired",
      badgeClass: "membership-card__badge membership-card__badge--danger",
      active: phase === "membership_expired",
      lines: endStr ? [{ k: "Ended", v: endStr }] : undefined
    }
  ];

  return (
    <section className="membership-billing" aria-label="Membership and billing">
      <div className="membership-billing__shell">
        <div className="membership-billing__head">
          <h2 className="membership-billing__title">Membership &amp; billing</h2>
          <p className="membership-billing__summary">{membershipPrimaryStatusLabel(phase)}</p>
        </div>
        <div className="membership-billing__grid">
          {cards.map((c) => (
            <article
              key={c.key}
              className={`membership-card membership-card--${c.tone}${c.active ? " membership-card--emphasis" : ""}`}
            >
              <header className="membership-card__header">
                <h3 className="membership-card__title">{c.title}</h3>
                <span className={c.badgeClass}>{c.badge}</span>
              </header>
              <p className="membership-card__desc">{c.desc}</p>
              {c.lines?.length ? (
                <dl className="membership-card__dl">
                  {c.lines.map((row) => (
                    <div key={row.k} className="membership-card__dl-row">
                      <dt>{row.k}</dt>
                      <dd>{row.v}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
