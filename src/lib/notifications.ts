import { differenceInCalendarDays, format, isValid, parseISO } from "date-fns";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import {
  computeMonthlyMembershipWindow,
  MEMBERSHIP_REMINDER_DAYS_LEFT
} from "@/lib/membership-billing";
import { subscriptionStatusFromDate } from "@/lib/subscription-ui";
import { paymentStatusLabel } from "@/lib/utils";

function formatSessionLine(startsAt: string, locationName: string, kitRequirements: string): string {
  try {
    const d = parseISO(startsAt);
    if (!isValid(d)) return `<li>${locationName} (${kitRequirements})</li>`;
    return `<li>${format(d, "EEE HH:mm")} - ${locationName} (${kitRequirements})</li>`;
  } catch {
    return `<li>${locationName} (${kitRequirements})</li>`;
  }
}

function formatWhen(startsAt: string, endsAt?: string): string {
  try {
    const start = parseISO(startsAt);
    if (!isValid(start)) return startsAt;
    if (!endsAt) return format(start, "PPP 'at' p");
    const end = parseISO(endsAt);
    if (!isValid(end)) return format(start, "PPP 'at' p");
    return `${format(start, "PPP")} • ${format(start, "p")} - ${format(end, "p")}`;
  } catch {
    return startsAt;
  }
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendRegistrationDecisionEmail(
  email: string,
  playerName: string,
  approved: boolean,
  ageGroup?: string
) {
  const title = approved ? "Registration Approved" : "Registration Rejected";
  if (!approved) {
    return sendEmail(
      email,
      title,
      `<p>Hello, ${playerName}'s registration was rejected.</p><p>Please contact academy support for guidance.</p>`
    );
  }
  return sendEmail(
    email,
    title,
    `<p>Hello, ${playerName} has been admitted to FTPR Lions.</p>
<p><strong>Assigned group:</strong> ${ageGroup ?? "TBD"}</p>
<p>We look forward to welcoming your child to training.</p>`
  );
}

export async function sendPaymentApprovedEmail(input: {
  email: string;
  playerName: string;
  paymentFor: string;
  amount: number;
  currency: string;
  paidAt?: string;
  membershipStartsAt: string;
  membershipEndsAt: string;
}) {
  const when = input.paidAt ? formatWhen(input.paidAt) : "today";
  const membershipStarts = formatWhen(input.membershipStartsAt);
  const membershipEnds = formatWhen(input.membershipEndsAt);
  return sendEmail(
    input.email,
    "Payment Approved",
    `<p>Hello, your payment has been approved by admin.</p>
<p><strong>Player:</strong> ${input.playerName}<br/>
<strong>Payment:</strong> ${input.paymentFor}<br/>
<strong>Amount:</strong> ${input.amount.toLocaleString()} ${input.currency}<br/>
<strong>Approved on:</strong> ${when}</p>
<p><strong>Membership period:</strong><br/>
Start date: ${membershipStarts}<br/>
End date: ${membershipEnds}</p>
<p>Thank you for your registration/payment.</p>`
  );
}

export function isRegistrationFee(paymentFor: string) {
  return /\bregistration\b/i.test(paymentFor);
}

export function isMembershipFee(paymentFor: string) {
  return /\bmembership\b|\bmonthly\b/i.test(paymentFor);
}

export async function sendRegistrationPaymentRequestEmail(input: {
  email: string;
  parentName: string;
  playerName: string;
  ageGroup: string;
  amount: number;
  currency: string;
  dueDate: string;
  paymentFor: string;
}) {
  const due = formatWhen(input.dueDate);
  return sendEmail(
    input.email,
    "Registration Received — Registration Fee Pending",
    `<p>Hello ${input.parentName},</p>
<p>${input.playerName}'s registration has been received and is currently <strong>pending payment approval</strong>.</p>
<p><strong>Assigned group:</strong> ${input.ageGroup}<br/>
<strong>Fee:</strong> ${input.amount.toLocaleString()} ${input.currency}<br/>
<strong>For:</strong> ${input.paymentFor}<br/>
<strong>Due date:</strong> ${due}</p>
<p>After registration fee payment is confirmed, the player can be admitted. Monthly fees are billed and approved separately.</p>`
  );
}

export async function sendInvoiceIssuedEmail(input: {
  email: string;
  parentName: string;
  playerName: string;
  group: string;
  amount: number;
  currency: string;
  dueDate: string;
  description: string;
}) {
  return sendEmail(
    input.email,
    `Invoice Issued — ${input.playerName}`,
    `<p>Hello ${escapeHtml(input.parentName)},</p>
<p>A new invoice has been issued for <strong>${escapeHtml(input.playerName)}</strong>.</p>
<p><strong>Group:</strong> ${escapeHtml(input.group)}<br/>
<strong>Description:</strong> ${escapeHtml(input.description)}<br/>
<strong>Amount:</strong> ${input.amount.toLocaleString()} ${escapeHtml(input.currency)}<br/>
<strong>Due date:</strong> ${formatWhen(input.dueDate)}</p>
<p>Please complete payment and share reference/proof if available.</p>`
  );
}

/** Follow-up when payment is still outstanding; states period ended and, if applicable, when the invoice was first emailed. */
export async function sendInvoicePaymentReminderEmail(input: {
  email: string;
  parentName: string;
  playerName: string;
  group: string;
  amount: number;
  currency: string;
  dueDate: string;
  paymentFor: string;
  /** ISO timestamp of first send; included in copy so parents know this is not a duplicate invoice. */
  invoiceFirstSentAt?: string;
}) {
  const due = formatWhen(input.dueDate);
  const sentDetail = input.invoiceFirstSentAt
    ? `<p>The same invoice was already sent to you on <strong>${formatWhen(input.invoiceFirstSentAt)}</strong>. This message is a payment reminder—not a new invoice.</p>`
    : `<p>If you have not yet received the invoice email, please check spam or contact the academy.</p>`;

  return sendEmail(
    input.email,
    `Payment reminder — ${input.playerName}`,
    `<p>Hello ${escapeHtml(input.parentName)},</p>
<p>The monthly membership period for <strong>${escapeHtml(input.playerName)}</strong> covered by this invoice has ended (due date: <strong>${due}</strong>).</p>
${sentDetail}
<p><strong>Group:</strong> ${escapeHtml(input.group)}<br/>
<strong>For:</strong> ${escapeHtml(input.paymentFor)}<br/>
<strong>Amount:</strong> ${input.amount.toLocaleString()} ${escapeHtml(input.currency)}</p>
<p>Please complete payment when you can, and send proof or reference if your club requests it.</p>`
  );
}

export async function sendOverduePaymentEmail(input: {
  email: string;
  parentName: string;
  playerName: string;
  amount: number;
  currency: string;
  dueDate: string;
  paymentFor: string;
}) {
  return sendEmail(
    input.email,
    `Payment Overdue — ${input.playerName}`,
    `<p>Hello ${input.parentName},</p>
<p>Your payment is overdue.</p>
<p><strong>Player:</strong> ${input.playerName}<br/>
<strong>For:</strong> ${input.paymentFor}<br/>
<strong>Amount:</strong> ${input.amount.toLocaleString()} ${input.currency}<br/>
<strong>Due date:</strong> ${formatWhen(input.dueDate)}</p>
<p>Please settle the balance as soon as possible.</p>`
  );
}

/**
 * Compute the membership window granted by a payment.
 *
 * Accepts EITHER a plain ISO string (legacy callers) OR an object with `paidAt` and the
 * player's prior `subscriptionValidUntil`. When a prior end date is provided, the new
 * window starts from that prior end (no gap, no overlap) — required for late renewals
 * per spec ("subscription ends May 1, paid May 8 → new window May 1 → June 1").
 */
export function getMonthlyMembershipWindow(
  fromIsoOrInput: string | { paidAt: string; priorValidUntil?: string | null }
): { startsAt: string; endsAt: string } {
  if (typeof fromIsoOrInput === "string") {
    return computeMonthlyMembershipWindow({ paidAt: fromIsoOrInput });
  }
  return computeMonthlyMembershipWindow({
    paidAt: fromIsoOrInput.paidAt,
    priorValidUntil: fromIsoOrInput.priorValidUntil ?? null
  });
}

export async function hasActivePaidMembership(playerId: string, validUntil?: string) {
  const subState = subscriptionStatusFromDate(validUntil);
  if (!(subState === "active" || subState === "expiring_soon")) return false;
  const payments = await db.listPaymentsForPlayer(playerId);
  return payments.some((p) => p.status === "paid" && isMembershipFee(p.paymentFor));
}

export async function sendPaymentReminder(playerId: string) {
  const parent = await db.getParentByPlayerId(playerId);
  if (!parent) return null;
  return sendEmail(parent.email, "Payment Reminder", "<p>Your player payment is due soon.</p>");
}

export async function dispatchOverduePaymentNotifications() {
  const payments = await db.listPayments();
  let sent = 0;
  for (const payment of payments) {
    if (payment.status !== "overdue") continue;
    const player = await db.getPlayer(payment.playerId);
    if (!player) continue;
    const parent = await db.getParentByPlayerId(player.id);
    if (!parent?.email) continue;
    await sendOverduePaymentEmail({
      email: parent.email,
      parentName: parent.parentName,
      playerName: player.playerName,
      amount: payment.amount,
      currency: payment.currency,
      dueDate: payment.dueDate,
      paymentFor: payment.paymentFor
    });
    sent += 1;
  }
  return { sent };
}

export async function sendWeeklyTimetable(group: string, email: string) {
  const sessions = await db.listSessions(group);
  const rows = sessions.map((s) => formatSessionLine(s.startsAt, s.locationName, s.kitRequirements)).join("");
  return sendEmail(email, `Weekly ${group} Timetable`, `<ul>${rows}</ul>`);
}

/**
 * Email parents when a group's timetable changes. Eligible players (approved + active paid membership)
 * are grouped by parent: one email per parent listing every matching child in that group so
 * multi-child families are not ambiguous.
 */
export async function notifyTimetableChange(
  ageGroup: string,
  action: "created" | "updated" | "removed",
  session: {
    title?: string;
    kind: string;
    startsAt: string;
    endsAt?: string;
    locationName: string;
    kitRequirements?: string;
  }
) {
  const players = await db.listPlayers({ includeWithdrawn: false, group: ageGroup, registration: "approved" });
  const when = formatWhen(session.startsAt, session.endsAt);
  const subject = `FTPR Lions — ${ageGroup} timetable ${action}`;
  const sessionHtml = `<p><strong>${action === "created" ? "New session" : action === "updated" ? "Updated session" : "Cancelled session"}</strong><br/>
${session.title ? `${escapeHtml(session.title)}<br/>` : ""}${escapeHtml(session.kind)} — ${escapeHtml(when)}<br/>${escapeHtml(session.locationName)}${session.kitRequirements ? `<br/>Kit: ${escapeHtml(session.kitRequirements)}` : ""}</p>`;

  type ParentBucket = { email: string; parentName: string; childNames: string[] };
  const byParentEmail = new Map<string, ParentBucket>();

  for (const pl of players) {
    const eligible = await hasActivePaidMembership(pl.id, pl.subscriptionValidUntil);
    if (!eligible) continue;
    const par = await db.getParentByPlayerId(pl.id);
    if (!par?.email) continue;
    const key = par.email.trim().toLowerCase();
    const name = pl.playerName.trim();
    const existing = byParentEmail.get(key);
    if (existing) {
      if (!existing.childNames.some((n) => n.toLowerCase() === name.toLowerCase())) {
        existing.childNames.push(pl.playerName);
      }
    } else {
      byParentEmail.set(key, { email: par.email.trim(), parentName: par.parentName, childNames: [pl.playerName] });
    }
  }

  for (const bucket of byParentEmail.values()) {
    const childrenBlock =
      bucket.childNames.length === 1
        ? `<p><strong>Player:</strong> ${escapeHtml(bucket.childNames[0])}</p>`
        : `<p><strong>Players (this update applies to each of them in ${escapeHtml(ageGroup)}):</strong></p><ul>${bucket.childNames.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>`;
    const html = `<p>Hello ${escapeHtml(bucket.parentName)},</p>
<p>There is a timetable update for group <strong>${escapeHtml(ageGroup)}</strong>.</p>
${childrenBlock}
${sessionHtml}
<p>Please check the academy schedule on our website for the latest details.</p>`;
    await sendEmail(bucket.email, subject, html);
  }
}

export async function sendSubscriptionExpiryReminders() {
  const players = await db.listPlayers({ includeWithdrawn: false, registration: "approved" });
  let checked = 0;
  let sent = 0;
  for (const pl of players) {
    if (!pl.subscriptionValidUntil) continue;
    checked += 1;
    const end = parseISO(pl.subscriptionValidUntil);
    if (!isValid(end)) continue;
    const daysLeft = differenceInCalendarDays(end, new Date());
    if (!(MEMBERSHIP_REMINDER_DAYS_LEFT as readonly number[]).includes(daysLeft)) continue;
    const parent = await db.getParentByPlayerId(pl.id);
    if (!parent?.email) continue;
    const payments = await db.listPaymentsForPlayer(pl.id);
    const latest = payments.sort((a, b) => b.dueDate.localeCompare(a.dueDate))[0];
    const headline =
      daysLeft === 0 ? "Subscription expires today" : `Subscription expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`;
    const when = format(end, "PPP");
    await sendEmail(
      parent.email,
      `FTPR Lions — ${headline}`,
      `<p>Hello, ${pl.playerName}'s monthly membership is ending soon.</p>
<p><strong>Expiry date:</strong> ${when}<br/>
<strong>Assigned group:</strong> ${pl.ageGroup}<br/>
<strong>Latest payment status:</strong> ${latest ? paymentStatusLabel(latest.status) : "Unpaid"}</p>
<p>Please complete renewal to avoid interruptions in training access.</p>`
    );
    sent += 1;
  }
  return { checked, sent };
}
