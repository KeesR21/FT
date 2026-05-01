import { differenceInYears, isBefore, isValid, parseISO } from "date-fns";
import { PaymentStatus } from "@/lib/types";

/** Minimum completed age (full years since date of birth) for public player registration. */
export const REGISTRATION_MIN_PLAYER_AGE_YEARS = 5;

/**
 * Validates date of birth for registration (YYYY-MM-DD from the form).
 * Uses full calendar years since birth, same basis as age groups.
 */
export function registrationDateOfBirthMeetsMinAge(
  dateOfBirth: string,
  minYears = REGISTRATION_MIN_PLAYER_AGE_YEARS,
  refDate = new Date()
): { ok: true } | { ok: false; message: string } {
  const dob = parseISO(dateOfBirth);
  if (!isValid(dob)) {
    return { ok: false, message: "That date of birth is not valid." };
  }
  if (dob.getTime() > refDate.getTime()) {
    return { ok: false, message: "Date of birth cannot be in the future." };
  }
  const years = differenceInYears(refDate, dob);
  if (years < minYears) {
    return {
      ok: false,
      message: `Players must be at least ${minYears} years old to register.`
    };
  }
  return { ok: true };
}

export function getAgeGroup(dateOfBirth: string): string {
  const age = differenceInYears(new Date(), parseISO(dateOfBirth));
  if (age <= 7) return "U7";
  if (age <= 9) return "U9";
  if (age <= 11) return "U11";
  if (age <= 14) return "U14A";
  if (age === 15) return "U14B";
  if (age <= 16) return "U16";
  return "U18";
}

export function computePaymentStatus(dueDate: string, paidAt?: string, currentStatus?: PaymentStatus): PaymentStatus {
  /** Persisted `paid` in the DB must win over date heuristics (avoids false unpaid if `paid_at` is missing or odd). */
  if (currentStatus === "paid") return "paid";
  if (paidAt) return "paid";
  if (currentStatus === "pending") return "pending";
  const now = new Date();
  const due = parseISO(dueDate);
  if (isBefore(due, now)) return "overdue";
  return "not_paid";
}

export function paymentStatusLabel(status: PaymentStatus | "unpaid"): "Paid" | "Pending" | "Unpaid" | "Overdue" {
  if (status === "paid") return "Paid";
  if (status === "pending") return "Pending";
  if (status === "overdue") return "Overdue";
  return "Unpaid";
}

export function jsonMessage(message: string, extra?: Record<string, unknown>) {
  return { message, ...(extra ?? {}) };
}
