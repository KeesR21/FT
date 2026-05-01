import { MEMBERSHIP_EXPIRING_SOON_DAYS } from "@/lib/membership-billing";
import type { SubscriptionUiStatus } from "@/lib/types";

/** Normalized invoice row status from the admin payments API (`uiStatus`). */
export type AdminLedgerUiStatus = "paid" | "pending" | "unpaid" | "overdue";

export type AdminPaymentRowModel = {
  /** Payment is not yet approved (unpaid, pending proof, or overdue). */
  needsAdminPaymentAction: boolean;
  canApprovePayment: boolean;
  canSendReminder: boolean;
  paymentBadgeClass: string;
  paymentBadgeLabel: string;
  subscriptionBadgeClass: string;
  subscriptionBadgeLabel: string;
  /** Optional class on `<tr>` for scan emphasis. */
  rowHighlightClass: string;
  approveTooltip: string;
  reminderTooltip: string;
};

export const ADMIN_PAYMENT_APPROVE_TOOLTIP =
  "Mark this payment as received. If this invoice is for the monthly fee, approving also starts or extends the player’s monthly membership period.";

export const ADMIN_PAYMENT_REMINDER_TOOLTIP =
  "Email the parent a reminder about this invoice (when outgoing mail is configured).";

/**
 * Single source of truth for admin finance tables: badge copy, colors, and which actions apply.
 * - Paid (approved): no approve / reminder.
 * - Pending action: unpaid, awaiting proof (`pending`), or overdue — same actions; subscription `expired` stays actionable like pending (reminder + approve).
 */
export function buildAdminPaymentRowModel(input: {
  uiStatus: AdminLedgerUiStatus;
  subscriptionUiStatus?: SubscriptionUiStatus;
}): AdminPaymentRowModel {
  const paid = input.uiStatus === "paid";
  const needsAdminPaymentAction = !paid;
  const sub = input.subscriptionUiStatus ?? "ended";

  let paymentBadgeClass: string;
  let paymentBadgeLabel: string;
  if (paid) {
    paymentBadgeClass = "admin-pay-badge admin-pay-badge--blue";
    paymentBadgeLabel = "Paid and recorded";
  } else if (input.uiStatus === "overdue") {
    paymentBadgeClass = "admin-pay-badge admin-pay-badge--red";
    paymentBadgeLabel = "Past due date";
  } else if (input.uiStatus === "pending") {
    paymentBadgeClass = "admin-pay-badge admin-pay-badge--orange";
    paymentBadgeLabel = "Payment proof under review";
  } else {
    paymentBadgeClass = "admin-pay-badge admin-pay-badge--orange";
    paymentBadgeLabel = "Waiting for payment";
  }

  let subscriptionBadgeClass: string;
  let subscriptionBadgeLabel: string;
  switch (sub) {
    case "active":
      subscriptionBadgeClass = "admin-pay-badge admin-pay-badge--blue-soft";
      subscriptionBadgeLabel = "Monthly membership is current";
      break;
    case "expiring_soon":
      subscriptionBadgeClass = "admin-pay-badge admin-pay-badge--orange";
      subscriptionBadgeLabel =
        MEMBERSHIP_EXPIRING_SOON_DAYS <= 1
          ? "Monthly term ends today or tomorrow"
          : `Monthly term ends within ${MEMBERSHIP_EXPIRING_SOON_DAYS} days`;
      break;
    case "expired":
      subscriptionBadgeClass = "admin-pay-badge admin-pay-badge--red";
      subscriptionBadgeLabel = "Monthly membership has ended";
      break;
    case "ended":
      subscriptionBadgeClass = "admin-pay-badge admin-pay-badge--muted";
      subscriptionBadgeLabel = "No monthly membership dates yet";
      break;
    default:
      subscriptionBadgeClass = "admin-pay-badge admin-pay-badge--muted";
      subscriptionBadgeLabel = "Monthly status unknown";
  }

  let rowHighlightClass = "";
  if (!paid) {
    if (input.uiStatus === "overdue" || sub === "expired") {
      rowHighlightClass = "admin-pay-row--urgent";
    } else {
      rowHighlightClass = "admin-pay-row--attention";
    }
  }

  return {
    needsAdminPaymentAction,
    canApprovePayment: needsAdminPaymentAction,
    canSendReminder: needsAdminPaymentAction,
    paymentBadgeClass,
    paymentBadgeLabel,
    subscriptionBadgeClass,
    subscriptionBadgeLabel,
    rowHighlightClass,
    approveTooltip: ADMIN_PAYMENT_APPROVE_TOOLTIP,
    reminderTooltip: ADMIN_PAYMENT_REMINDER_TOOLTIP
  };
}
