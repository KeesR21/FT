import { addDays, differenceInCalendarDays, format, isValid, parseISO, startOfDay } from "date-fns";
import type { Payment, Player } from "@/lib/types";

/** Days before membership end when we treat as “expiring soon” (UI + subscription status). */
export const MEMBERSHIP_EXPIRING_SOON_DAYS = 3;

/** Cron / email reminders: days-left values that trigger a reminder. */
export const MEMBERSHIP_REMINDER_DAYS_LEFT = [MEMBERSHIP_EXPIRING_SOON_DAYS, 1, 0] as const;

/** Length of one paid monthly membership term, in days. Single source of truth. */
export const MEMBERSHIP_PERIOD_DAYS = 30;

/** A player whose subscription has been overdue strictly more than this many days is flagged as Danger. */
export const DANGER_DAYS_OVERDUE = 5;

export type MembershipLifecyclePhase =
  | "registration_fee_pending"
  | "applicant_registration_paid"
  | "rejected"
  | "active_membership_unpaid"
  | "membership_active"
  | "membership_expiring_soon"
  | "membership_expired";

export type RegistrationFeeUiStatus = "pending" | "paid";

export function registrationFeePaid(payments: { paymentFor: string; status: string }[]): boolean {
  return payments.some((p) => p.status === "paid" && /\bregistration\b/i.test(p.paymentFor));
}

/** Paid monthly membership fee (not registration). */
export function hasPaidMonthlyMembership(payments: { paymentFor: string; status: string }[]): boolean {
  return payments.some((p) => p.status === "paid" && /\bmonthly\b|\bmembership\b/i.test(p.paymentFor));
}

export function latestPaidMembershipPayment(
  payments: { paymentFor: string; status: string; paidAt?: string }[]
): { paidAt: string } | null {
  const rows = payments.filter((p) => p.status === "paid" && /\bmonthly\b|\bmembership\b/i.test(p.paymentFor) && p.paidAt);
  if (!rows.length) return null;
  rows.sort((a, b) => String(b.paidAt).localeCompare(String(a.paidAt)));
  const paidAt = rows[0]!.paidAt!;
  return { paidAt };
}

function subscriptionEndDay(player: Player): Date | null {
  if (!player.subscriptionValidUntil) return null;
  const d = parseISO(player.subscriptionValidUntil);
  return isValid(d) ? startOfDay(d) : null;
}

export function membershipDaysRemaining(player: Player, now: Date = new Date()): number | null {
  const end = subscriptionEndDay(player);
  if (!end) return null;
  return differenceInCalendarDays(end, startOfDay(now));
}

/**
 * Single source of truth for membership vs registration billing (admin / parent UI).
 */
export function computeMembershipLifecyclePhase(
  player: Player,
  payments: { paymentFor: string; status: string }[],
  now: Date = new Date()
): MembershipLifecyclePhase {
  if (player.registrationStatus === "rejected") return "rejected";
  if (player.registrationStatus === "pending") {
    return registrationFeePaid(payments) ? "applicant_registration_paid" : "registration_fee_pending";
  }
  // approved
  const end = subscriptionEndDay(player);
  if (!end) return "active_membership_unpaid";
  const days = differenceInCalendarDays(end, startOfDay(now));
  if (days < 0) return "membership_expired";
  if (days <= MEMBERSHIP_EXPIRING_SOON_DAYS) return "membership_expiring_soon";
  return "membership_active";
}

export function registrationFeeUiStatus(payments: { paymentFor: string; status: string }[]): RegistrationFeeUiStatus {
  return registrationFeePaid(payments) ? "paid" : "pending";
}

/** e.g. "Membership for April 2026 ended on April 10, 2026." */
export function membershipEndedMessage(subscriptionValidUntil: string | undefined): string {
  if (!subscriptionValidUntil) return "There is no saved end date for a monthly membership period.";
  const end = parseISO(subscriptionValidUntil);
  if (!isValid(end)) return "The membership end date on file could not be read.";
  const monthLabel = format(end, "LLLL yyyy");
  const dateLabel = format(end, "PPP");
  return `Membership for ${monthLabel} ended on ${dateLabel}.`;
}

/**
 * Number of whole calendar days the player is past their subscription end date.
 * - Returns 0 when the subscription is still current (or unknown).
 * - Used for the Danger flag (`isPlayerInDanger`) and overdue-aging displays.
 */
export function daysSinceSubscriptionEnded(
  subscriptionValidUntil: string | undefined,
  now: Date = new Date()
): number {
  if (!subscriptionValidUntil) return 0;
  const end = parseISO(subscriptionValidUntil);
  if (!isValid(end)) return 0;
  const diff = differenceInCalendarDays(startOfDay(now), startOfDay(end));
  return diff > 0 ? diff : 0;
}

/**
 * A player is in Danger when their monthly membership ended strictly more than
 * `DANGER_DAYS_OVERDUE` days ago AND they have not been withdrawn. Pending applicants
 * never qualify because they don’t yet have a subscription window.
 */
export function isPlayerInDanger(player: Player, now: Date = new Date()): boolean {
  if (player.status === "withdrawn") return false;
  if (player.registrationStatus !== "approved") return false;
  return daysSinceSubscriptionEnded(player.subscriptionValidUntil, now) > DANGER_DAYS_OVERDUE;
}

/**
 * Compute the next monthly membership window when admitting / renewing.
 *
 * Rule (per business spec):
 * - First-ever monthly payment OR no prior subscription → start = `paidAt`.
 * - Late renewal after expiry → start = previous subscription end date.
 * - Early renewal while still active → start = previous end (no gap, no overlap).
 *
 * End is always start + {@link MEMBERSHIP_PERIOD_DAYS}.
 * Both fields are returned as ISO timestamps so the caller can persist or display.
 */
export function computeMonthlyMembershipWindow(input: {
  paidAt: string;
  priorValidUntil?: string | null;
}): { startsAt: string; endsAt: string } {
  const paid = parseISO(input.paidAt);
  const paidDate = isValid(paid) ? paid : new Date();
  let start = paidDate;
  if (input.priorValidUntil) {
    const prior = parseISO(input.priorValidUntil);
    if (isValid(prior)) start = prior;
  }
  const end = addDays(start, MEMBERSHIP_PERIOD_DAYS);
  return { startsAt: start.toISOString(), endsAt: end.toISOString() };
}

/**
 * Project the membership window for a not-yet-paid monthly invoice (used in the
 * Approvals UI so admins can preview which month, start and end the player will get
 * once they pay). For unpaid renewals we honour prior end; otherwise the start defaults
 * to today so the preview is honest.
 */
export function projectUpcomingMembershipWindow(
  player: Player,
  now: Date = new Date()
): { startsAt: string; endsAt: string } {
  return computeMonthlyMembershipWindow({
    paidAt: now.toISOString(),
    priorValidUntil: player.subscriptionValidUntil ?? null
  });
}

/** Whether the player still has time on their current membership and is not yet eligible to renew. */
export function isWithinActiveMembership(
  player: Player,
  now: Date = new Date()
): boolean {
  if (!player.subscriptionValidUntil) return false;
  const end = parseISO(player.subscriptionValidUntil);
  if (!isValid(end)) return false;
  return differenceInCalendarDays(startOfDay(end), startOfDay(now)) > MEMBERSHIP_EXPIRING_SOON_DAYS;
}

/** Marker prefix written to `paymentNotes` when an admin voids an invoice. */
export const VOIDED_NOTE_PREFIX = "[VOIDED";

/** True when the invoice has been voided by an admin and should be ignored by guards. */
export function isVoidedInvoice(payment: Pick<Payment, "paymentNotes">): boolean {
  return Boolean(payment.paymentNotes?.startsWith(VOIDED_NOTE_PREFIX));
}

/**
 * Returns the open (un-paid, non-voided) monthly invoice for the player, if any.
 * Used as a duplicate guard before creating new monthly invoices.
 */
export function findOpenMonthlyInvoice(payments: Payment[]): Payment | null {
  return (
    payments.find(
      (p) =>
        p.status !== "paid" &&
        !isVoidedInvoice(p) &&
        /\bmonthly\b|\bmembership\b/i.test(p.paymentFor)
    ) ?? null
  );
}

export function membershipPrimaryStatusLabel(phase: MembershipLifecyclePhase): string {
  switch (phase) {
    case "registration_fee_pending":
      return "Waiting for the one-time registration payment";
    case "applicant_registration_paid":
      return "Registration paid — application is under review";
    case "rejected":
      return "Application was not accepted";
    case "active_membership_unpaid":
      return "Player is admitted — monthly fee not paid yet";
    case "membership_active":
      return "Monthly membership is active";
    case "membership_expiring_soon":
      return `Monthly membership ends within ${MEMBERSHIP_EXPIRING_SOON_DAYS} days — time to renew`;
    case "membership_expired":
      return "Monthly membership has ended — renew to continue";
    default:
      return "Status could not be determined";
  }
}
