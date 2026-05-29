import { format } from "date-fns";
import {
  findOpenMonthlyInvoice,
  isVoidedInvoice,
  isWithinActiveMembership
} from "@/lib/membership-billing";
import type { Payment, Player } from "@/lib/types";

export function monthKey(iso: string) {
  return iso.slice(0, 7);
}

/** Canonical “For” text for registration invoices on the ledger. */
export const LEDGER_REGISTRATION_FEE_LABEL = "Registration fee";

/** Invoice line for a calendar-month fee, e.g. `Monthly fee — April` (uses the due date’s month). */
export function monthlyFeePaymentFor(dueIso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dueIso.trim());
  if (!m) return "Monthly fee";
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  if (!y || !mo || mo < 1 || mo > 12) return "Monthly fee";
  const d = new Date(y, mo - 1, Number.isFinite(day) && day > 0 ? day : 1);
  return `Monthly fee — ${format(d, "LLLL")}`;
}

/**
 * Ledger only supports two “For” lines: {@link LEDGER_REGISTRATION_FEE_LABEL} or `Monthly fee — {month}`.
 * Anything that is not a registration fee is shown/treated as the monthly line for the invoice due month.
 */
export function resolveLedgerPaymentFor(storedPaymentFor: string, dueIso: string): string {
  if (/\bregistration\b/i.test(storedPaymentFor)) return LEDGER_REGISTRATION_FEE_LABEL;
  return monthlyFeePaymentFor(dueIso);
}

export function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string) {
  return phone.replace(/\D+/g, "");
}

export function isDuplicateOpenInvoice(
  existing: Payment[],
  input: { paymentFor: string; dueDate: string }
) {
  const purpose = normalizeText(resolveLedgerPaymentFor(input.paymentFor, input.dueDate));
  const dueMonth = monthKey(input.dueDate);
  return existing.find(
    (p) =>
      !isVoidedInvoice(p) &&
      normalizeText(resolveLedgerPaymentFor(p.paymentFor, p.dueDate)) === purpose &&
      monthKey(p.dueDate) === dueMonth &&
      p.status !== "paid"
  );
}

/** Reason why a monthly invoice cannot currently be created for a player. */
export type MonthlyInvoiceBlockReason =
  | "open_monthly_invoice_exists"
  | "active_subscription_not_renewable_yet"
  | "duplicate_for_month";

export type MonthlyInvoiceGuardResult =
  | { ok: true }
  | { ok: false; reason: MonthlyInvoiceBlockReason; existing?: Payment };

/**
 * Authoritative pre-check before creating a new monthly membership invoice.
 *
 * Blocks creation when:
 * 1. The player still has an unpaid open monthly invoice (`open_monthly_invoice_exists`).
 * 2. The player has an active subscription that is NOT yet inside the renewal window
 *    (`active_subscription_not_renewable_yet`) — protects against charging current players again.
 * 3. There is already a non-paid invoice for the same calendar month (`duplicate_for_month`).
 *
 * Pass `now` for deterministic tests / cron jobs.
 */
export function canCreateNewMonthlyInvoice(input: {
  player: Player;
  payments: Payment[];
  dueDate: string;
  now?: Date;
}): MonthlyInvoiceGuardResult {
  const { player, payments } = input;
  const now = input.now ?? new Date();

  const openMonthly = findOpenMonthlyInvoice(payments);
  if (openMonthly) {
    return { ok: false, reason: "open_monthly_invoice_exists", existing: openMonthly };
  }

  const dupForMonth = isDuplicateOpenInvoice(payments, {
    paymentFor: monthlyFeePaymentFor(input.dueDate),
    dueDate: input.dueDate
  });
  if (dupForMonth) {
    return { ok: false, reason: "duplicate_for_month", existing: dupForMonth };
  }

  if (isWithinActiveMembership(player, now)) {
    return { ok: false, reason: "active_subscription_not_renewable_yet" };
  }

  return { ok: true };
}
