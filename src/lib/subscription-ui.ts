import { addDays, differenceInCalendarDays, parseISO, startOfDay } from "date-fns";
import { MEMBERSHIP_EXPIRING_SOON_DAYS } from "@/lib/membership-billing";
import type { SubscriptionUiStatus } from "@/lib/types";

/** Maps subscription end date to a dashboard status (independent of payment row status). */
export function subscriptionStatusFromDate(validUntil: string | undefined): SubscriptionUiStatus {
  if (!validUntil) return "ended";
  const end = parseISO(validUntil);
  const now = new Date();
  const days = differenceInCalendarDays(end, startOfDay(now));
  if (days < 0) return "expired";
  if (days <= MEMBERSHIP_EXPIRING_SOON_DAYS) return "expiring_soon";
  return "active";
}

export function defaultSubscriptionEnd(fromDate: Date = new Date()): string {
  return addDays(fromDate, 30).toISOString();
}
