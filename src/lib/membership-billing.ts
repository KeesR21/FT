import { differenceInCalendarDays, format, isValid, parseISO, startOfDay } from "date-fns";
import type { Player } from "@/lib/types";

/** Days before membership end when we treat as “expiring soon” (UI + subscription status). */
export const MEMBERSHIP_EXPIRING_SOON_DAYS = 3;

/** Cron / email reminders: days-left values that trigger a reminder. */
export const MEMBERSHIP_REMINDER_DAYS_LEFT = [MEMBERSHIP_EXPIRING_SOON_DAYS, 1, 0] as const;

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
