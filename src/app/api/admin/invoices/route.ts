import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  createInvoiceLog,
  getInvoiceLog,
  listInvoiceLogs,
  markInvoiceSent,
  updateInvoiceLogPaymentId
} from "@/lib/invoice-log-store";
import { generateCombinedInvoicePdf, generateMonthlyInvoicePdf } from "@/lib/invoice-pdf";
import { findOpenMonthlyInvoice } from "@/lib/membership-billing";
import {
  canCreateNewMonthlyInvoice,
  isDuplicateOpenInvoice,
  monthlyFeePaymentFor,
  monthKey
} from "@/lib/payment-guards";
import { getMonthlyFeeForGroup, loadPricing } from "@/lib/pricing-store";
import {
  createCombinedInvoiceLog,
  getCombinedInvoiceLog,
  listCombinedInvoiceLogs,
  markCombinedInvoiceSent,
  type CombinedInvoiceLineItem,
  type CombinedInvoiceLog
} from "@/lib/combined-invoice-log-store";
import { revalidateAdminViews } from "@/lib/revalidate-admin";
import { requireAdmin } from "@/lib/require-admin";
import {
  getMonthlyMembershipWindow,
  sendInvoiceIssuedEmail,
  sendInvoicePaymentReminderEmail,
  sendPaymentApprovedEmail
} from "@/lib/notifications";
import type { AdminInvoiceLog, Payment } from "@/lib/types";

const ORG_NAME = process.env.ACADEMY_ORG_NAME ?? "FTPR Lions Academy";
const PAYMENT_INSTRUCTIONS =
  process.env.INVOICE_PAYMENT_INSTRUCTIONS ??
  "Pay via academy-approved channels and include player full name as reference.";

function daysUntil(dateIso: string): number {
  const now = new Date();
  const target = new Date(dateIso);
  const ms = target.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function periodLabelFromDate(dateIso: string): string {
  const d = new Date(dateIso);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function buildInvoiceNumber(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const s = String(now.getTime()).slice(-6);
  return `INV-${y}${m}-${s}`;
}

/**
 * Invoice logs persist on disk; payments are in the DB (or in-memory mock, lost on restart).
 * Relink to an existing row when possible; otherwise recreate the monthly fee row from the log.
 */
async function resolvePaymentForInvoiceLog(
  log: AdminInvoiceLog
): Promise<{ payment: Payment; log: AdminInvoiceLog } | null> {
  const direct = await db.getPayment(log.paymentId);
  if (direct) return { payment: direct, log };

  const player = await db.getPlayer(log.playerId);
  if (!player) return null;

  let candidates = await db.listPaymentsForPlayer(log.playerId);
  const dueDay = log.dueDate.slice(0, 10);

  let match: Payment | undefined =
    candidates.find(
      (p) =>
        p.dueDate.slice(0, 10) === dueDay &&
        Number(p.amount) === Number(log.amount) &&
        p.currency === log.currency
    ) ?? candidates.find((p) => p.dueDate.slice(0, 10) === dueDay);

  if (!match) {
    const paymentFor = monthlyFeePaymentFor(log.dueDate);
    const dup = isDuplicateOpenInvoice(candidates, { paymentFor, dueDate: log.dueDate });
    if (dup) match = dup;
  }

  if (!match) {
    const paymentFor = monthlyFeePaymentFor(log.dueDate);
    candidates = await db.listPaymentsForPlayer(log.playerId);
    if (isDuplicateOpenInvoice(candidates, { paymentFor, dueDate: log.dueDate })) {
      match = isDuplicateOpenInvoice(candidates, { paymentFor, dueDate: log.dueDate })!;
    } else {
      match = await db.createPayment({
        playerId: log.playerId,
        amount: log.amount,
        currency: log.currency,
        paymentFor,
        dueDate: log.dueDate,
        paymentNotes: `Restored from invoice ${log.invoiceNumber} (log was orphaned from DB).`
      });
    }
  }

  if (!match) return null;

  const patched = await updateInvoiceLogPaymentId(log.id, match.id);
  return { payment: match, log: patched ?? { ...log, paymentId: match.id } };
}

type EligiblePlayerRow = {
  playerId: string;
  playerName: string;
  ageGroup: string;
  parentId: string;
  parentName: string;
  parentEmail: string;
  subscriptionValidUntil: string;
  daysLeft: number;
  canGenerateInvoice: boolean;
  hasInvoiceLog: boolean;
  latestInvoice: AdminInvoiceLog | undefined;
};

async function eligiblePlayers(): Promise<EligiblePlayerRow[]> {
  const players = await db.listPlayers({ includeWithdrawn: false, registration: "approved" });
  const logs = await listInvoiceLogs();
  return await Promise.all(
    players
      .filter((p) => p.subscriptionValidUntil)
      .map(async (p) => {
        const parent = await db.getParentByPlayerId(p.id);
        const daysLeft = daysUntil(p.subscriptionValidUntil!);
        const withinWindow = daysLeft >= 0 && daysLeft <= 5;
        const latestInvoice = logs.find((x) => x.playerId === p.id);
        return {
          playerId: p.id,
          playerName: p.playerName,
          ageGroup: p.ageGroup,
          parentId: p.parentId,
          parentName: parent?.parentName ?? "—",
          parentEmail: parent?.email ?? "",
          subscriptionValidUntil: p.subscriptionValidUntil!,
          daysLeft,
          canGenerateInvoice: withinWindow,
          hasInvoiceLog: Boolean(latestInvoice),
          latestInvoice
        };
      })
  );
}

/**
 * Find parents with 2+ players whose `subscriptionValidUntil` falls in the same calendar month
 * AND are within the renewal window. Each bundle is a single combined-billing candidate.
 */
type CombinedCandidate = {
  parentId: string;
  parentName: string;
  parentEmail: string;
  monthKey: string;
  /** Latest dueDate across the players (used as the bill due). */
  dueDate: string;
  players: EligiblePlayerRow[];
};

function buildCombinedBillingCandidates(rows: EligiblePlayerRow[]): CombinedCandidate[] {
  const eligible = rows.filter((r) => r.canGenerateInvoice && r.parentId && r.parentEmail);
  const byKey = new Map<string, EligiblePlayerRow[]>();
  for (const r of eligible) {
    const key = `${r.parentId}:${monthKey(r.subscriptionValidUntil)}`;
    const arr = byKey.get(key) ?? [];
    arr.push(r);
    byKey.set(key, arr);
  }
  const candidates: CombinedCandidate[] = [];
  for (const [key, players] of byKey.entries()) {
    if (players.length < 2) continue;
    const [parentId, mk] = key.split(":");
    const dueDate = players
      .map((p) => p.subscriptionValidUntil)
      .sort((a, b) => b.localeCompare(a))[0]!;
    candidates.push({
      parentId: parentId!,
      parentName: players[0]!.parentName,
      parentEmail: players[0]!.parentEmail,
      monthKey: mk!,
      dueDate,
      players
    });
  }
  return candidates.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

async function enrichCombinedLogs(logs: CombinedInvoiceLog[]) {
  return await Promise.all(
    logs.map(async (log) => {
      const lineStatuses = await Promise.all(
        log.lineItems.map(async (line) => {
          const p = await db.getPayment(line.paymentId);
          return { paymentId: line.paymentId, status: p?.status ?? "not_paid" };
        })
      );
      const allPaid = lineStatuses.length > 0 && lineStatuses.every((s) => s.status === "paid");
      const anyOverdue = lineStatuses.some((s) => s.status === "overdue");
      const overall = allPaid ? "paid" : anyOverdue ? "overdue" : "pending";
      return { ...log, lineStatuses, overallStatus: overall };
    })
  );
}

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const [eligible, logs, combinedLogs] = await Promise.all([
    eligiblePlayers(),
    listInvoiceLogs(),
    listCombinedInvoiceLogs()
  ]);
  const logsWithPayment = await Promise.all(
    logs.map(async (log) => {
      const resolved = await resolvePaymentForInvoiceLog(log);
      const activeLog = resolved?.log ?? log;
      const paymentStatus = resolved?.payment.status ?? "not_paid";
      return {
        ...activeLog,
        paymentStatus
      };
    })
  );
  const combinedCandidates = buildCombinedBillingCandidates(eligible);
  const combinedLogsEnriched = await enrichCombinedLogs(combinedLogs);
  return NextResponse.json({
    eligible,
    logs: logsWithPayment,
    combinedCandidates,
    combinedLogs: combinedLogsEnriched
  });
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("generate"),
    playerId: z.string().min(1)
  }),
  z.object({
    action: z.literal("send"),
    logId: z.string().min(1)
  }),
  z.object({
    action: z.literal("approve"),
    logId: z.string().min(1)
  }),
  z.object({
    action: z.literal("remind"),
    logId: z.string().min(1)
  }),
  z.object({
    action: z.literal("generate-combined"),
    parentId: z.string().min(1),
    /** ISO date or yyyy-mm-dd; the latest dueDate from the bundle. */
    dueDate: z.string().min(8)
  }),
  z.object({
    action: z.literal("send-combined"),
    combinedLogId: z.string().min(1)
  }),
  z.object({
    action: z.literal("approve-combined"),
    combinedLogId: z.string().min(1)
  })
]);

async function generateCombinedInvoice(input: {
  parentId: string;
  /** ISO date or yyyy-mm-dd; the latest dueDate from the bundle. */
  requestedDueDate: string;
  adminEmail: string;
}): Promise<
  | { error: string; status: number }
  | { log: CombinedInvoiceLog }
> {
  const players = await db.listPlayers({ includeWithdrawn: false, registration: "approved" });
  const siblings = players.filter((p) => p.parentId === input.parentId && Boolean(p.subscriptionValidUntil));
  if (siblings.length < 2) {
    return {
      error:
        "Combined billing requires the parent to have at least two active players with a membership end date.",
      status: 400
    };
  }
  const requestedMonth = monthKey(input.requestedDueDate);
  const inMonth = siblings.filter((p) => monthKey(p.subscriptionValidUntil!) === requestedMonth);
  if (inMonth.length < 2) {
    return {
      error:
        "Combined billing requires two or more siblings to renew in the same calendar month. Stagger separate invoices instead.",
      status: 400
    };
  }
  const parent = await db.getParentByPlayerId(inMonth[0]!.id);
  if (!parent?.email) {
    return { error: "Parent email is required before generating a combined invoice.", status: 400 };
  }

  const pricing = await loadPricing();
  const dueDate = inMonth.map((p) => p.subscriptionValidUntil!).sort((a, b) => b.localeCompare(a))[0]!;
  const periodLabel = periodLabelFromDate(dueDate);
  const invoiceNumber = `${buildInvoiceNumber()}-FAM`;

  const lineItems: CombinedInvoiceLineItem[] = [];
  for (const player of inMonth) {
    const fee = getMonthlyFeeForGroup(pricing, player.ageGroup);
    const playerDue = player.subscriptionValidUntil!;
    const paymentFor = monthlyFeePaymentFor(playerDue);
    const existing = await db.listPaymentsForPlayer(player.id);
    const openMonthly = findOpenMonthlyInvoice(existing);
    let payment = openMonthly ?? null;
    if (!payment) {
      const guard = canCreateNewMonthlyInvoice({ player, payments: existing, dueDate: playerDue });
      if (!guard.ok) {
        return {
          error: `Cannot include ${player.playerName} on the combined invoice (${guard.reason}).`,
          status: 409
        };
      }
      payment = await db.createPayment({
        playerId: player.id,
        amount: fee.amount,
        currency: fee.currency,
        paymentFor,
        dueDate: playerDue,
        paymentNotes: `Auto-generated combined family invoice ${invoiceNumber} (${player.ageGroup} fee).`
      });
    }
    lineItems.push({
      paymentId: payment.id,
      playerId: player.id,
      playerName: player.playerName,
      ageGroup: player.ageGroup,
      description: paymentFor,
      amount: payment.amount
    });
  }

  const total = lineItems.reduce((acc, l) => acc + l.amount, 0);
  const currency = lineItems[0]?.amount && pricing.defaultMonthlyFee.currency
    ? pricing.defaultMonthlyFee.currency
    : "RWF";

  const pdfBytes = await generateCombinedInvoicePdf({
    organizationName: ORG_NAME,
    invoiceTitle: "Family Combined Invoice",
    invoiceNumber,
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: dueDate.slice(0, 10),
    parentName: parent.parentName,
    periodLabel,
    currency,
    total,
    statusLabel: "Pending",
    paymentInstructions: PAYMENT_INSTRUCTIONS,
    lines: lineItems.map((l) => ({
      playerName: l.playerName,
      ageGroup: l.ageGroup,
      description: l.description,
      amount: l.amount
    }))
  });

  const dir = path.join(process.cwd(), "public", "uploads", "invoices");
  await mkdir(dir, { recursive: true });
  const fileName = `${invoiceNumber}.pdf`;
  await writeFile(path.join(dir, fileName), Buffer.from(pdfBytes));
  const pdfUrl = `/uploads/invoices/${fileName}`;

  const log = await createCombinedInvoiceLog({
    parentId: input.parentId,
    parentEmail: parent.email,
    parentName: parent.parentName,
    invoiceNumber,
    periodLabel,
    dueDate,
    currency,
    total,
    lineItems,
    playerIds: inMonth.map((p) => p.id),
    generatedAt: new Date().toISOString(),
    generatedBy: input.adminEmail,
    pdfUrl
  });

  return { log };
}

export async function POST(req: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const body = await req.json();
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid invoice action payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@ftprlions.com";

  if (parsed.data.action === "generate") {
    const player = await db.getPlayer(parsed.data.playerId);
    if (!player || !player.subscriptionValidUntil) {
      return NextResponse.json({ message: "Player or subscription not found." }, { status: 404 });
    }
    const parent = await db.getParentByPlayerId(player.id);
    if (!parent?.email) {
      return NextResponse.json({ message: "Parent email is required before generating invoice." }, { status: 400 });
    }
    const left = daysUntil(player.subscriptionValidUntil);
    if (left < 0 || left > 5) {
      return NextResponse.json({ message: "Invoice generation allowed only when subscription has 5 days or less remaining." }, { status: 400 });
    }
    const dueDate = player.subscriptionValidUntil;
    const paymentFor = monthlyFeePaymentFor(dueDate);
    const existing = await db.listPaymentsForPlayer(player.id);
    const guard = canCreateNewMonthlyInvoice({ player, payments: existing, dueDate });
    if (!guard.ok) {
      const messageMap: Record<typeof guard.reason, string> = {
        open_monthly_invoice_exists: `${player.playerName} already has an open monthly invoice. Resolve that one before generating another (only one open monthly invoice is allowed per player).`,
        active_subscription_not_renewable_yet: `${player.playerName} still has an active monthly subscription. Wait until the membership is in its last 3 days or has expired.`,
        duplicate_for_month: "Open monthly invoice already exists for this subscription period."
      };
      return NextResponse.json(
        { message: messageMap[guard.reason], code: "MONTHLY_INVOICE_BLOCKED", reason: guard.reason },
        { status: 409 }
      );
    }

    const pricing = await loadPricing();
    const fee = getMonthlyFeeForGroup(pricing, player.ageGroup);
    const amount = fee.amount;
    const currency = fee.currency;

    const payment = await db.createPayment({
      playerId: player.id,
      amount,
      currency,
      paymentFor,
      dueDate,
      paymentNotes: `Auto-generated monthly subscription invoice (${player.ageGroup} fee).`
    });

    const invoiceNumber = buildInvoiceNumber();
    const periodLabel = periodLabelFromDate(dueDate);
    const issueDate = new Date().toISOString().slice(0, 10);
    const pdfBytes = await generateMonthlyInvoicePdf({
      organizationName: ORG_NAME,
      invoiceTitle: "Monthly Subscription Invoice",
      invoiceNumber,
      issueDate,
      dueDate: dueDate.slice(0, 10),
      parentName: parent.parentName,
      playerName: player.playerName,
      ageGroup: player.ageGroup,
      periodLabel,
      amount,
      currency,
      statusLabel: "Pending",
      paymentInstructions: PAYMENT_INSTRUCTIONS
    });
    const dir = path.join(process.cwd(), "public", "uploads", "invoices");
    await mkdir(dir, { recursive: true });
    const fileName = `${invoiceNumber}.pdf`;
    await writeFile(path.join(dir, fileName), Buffer.from(pdfBytes));
    const pdfUrl = `/uploads/invoices/${fileName}`;
    const log = await createInvoiceLog({
      paymentId: payment.id,
      playerId: player.id,
      parentEmail: parent.email,
      parentName: parent.parentName,
      playerName: player.playerName,
      ageGroup: player.ageGroup,
      invoiceNumber,
      periodLabel,
      amount,
      currency,
      dueDate,
      generatedAt: new Date().toISOString(),
      generatedBy: adminEmail,
      pdfUrl
    });
    revalidateAdminViews();
    return NextResponse.json({ message: "Invoice generated", downloadUrl: pdfUrl, log });
  }

  if (parsed.data.action === "generate-combined") {
    const result = await generateCombinedInvoice({
      parentId: parsed.data.parentId,
      requestedDueDate: parsed.data.dueDate,
      adminEmail
    });
    if ("error" in result) {
      return NextResponse.json({ message: result.error }, { status: result.status });
    }
    revalidateAdminViews();
    return NextResponse.json({
      message: `Combined invoice created for ${result.log.parentName} (${result.log.lineItems.length} players).`,
      downloadUrl: result.log.pdfUrl,
      combinedLog: result.log
    });
  }

  if (parsed.data.action === "send-combined") {
    const log = await getCombinedInvoiceLog(parsed.data.combinedLogId);
    if (!log) return NextResponse.json({ message: "Combined invoice log not found." }, { status: 404 });
    if (log.sentAt) {
      const sentLabel = new Date(log.sentAt).toLocaleString(undefined, {
        dateStyle: "full",
        timeStyle: "short"
      });
      return NextResponse.json(
        {
          code: "INVOICE_ALREADY_SENT",
          message: "This combined invoice was already sent to the parent.",
          sentAt: log.sentAt,
          sentAtLabel: sentLabel,
          hint: "Use the per-player reminder buttons instead of resending the same combined invoice.",
          log
        },
        { status: 409 }
      );
    }

    const linePlayerNames = log.lineItems.map((l) => l.playerName).join(", ");
    let emailLine = "";
    if (!log.parentEmail) {
      emailLine = "No parent email on file—the combined invoice was not emailed.";
    } else {
      const emailResult = await sendInvoiceIssuedEmail({
        email: log.parentEmail,
        parentName: log.parentName,
        playerName: linePlayerNames,
        group: log.lineItems.map((l) => l.ageGroup).join(", "),
        amount: log.total,
        currency: log.currency,
        dueDate: log.dueDate,
        description: `Combined monthly fees — ${log.periodLabel}`
      });
      if ("skipped" in emailResult && emailResult.skipped) {
        emailLine =
          "Outgoing email is not configured (set RESEND_API_KEY and EMAIL_FROM in .env)—combined invoice is still marked as sent.";
      } else if ("failed" in emailResult && emailResult.failed) {
        emailLine = `Email could not be sent (${emailResult.error}). Combined invoice is still marked as sent—share the PDF manually.`;
      } else {
        emailLine = "Combined invoice email sent to the parent.";
      }
    }

    const next = await markCombinedInvoiceSent(log.id, adminEmail);
    if (!next) {
      return NextResponse.json({ message: "Could not update combined invoice log after send." }, { status: 500 });
    }
    const sentAtIso = new Date().toISOString();
    for (const line of log.lineItems) {
      await db.updatePayment(line.paymentId, { invoiceSentAt: sentAtIso });
    }
    revalidateAdminViews();
    return NextResponse.json({
      message: `${emailLine} Your PDF copy will open in a new tab.`,
      downloadUrl: log.pdfUrl,
      combinedLog: next
    });
  }

  if (parsed.data.action === "approve-combined") {
    const log = await getCombinedInvoiceLog(parsed.data.combinedLogId);
    if (!log) return NextResponse.json({ message: "Combined invoice log not found." }, { status: 404 });
    const skipped: string[] = [];
    const approved: string[] = [];
    for (const line of log.lineItems) {
      const before = await db.getPayment(line.paymentId);
      if (!before) {
        skipped.push(line.playerName);
        continue;
      }
      const player = await db.getPlayer(line.playerId);
      if (!player) {
        skipped.push(line.playerName);
        continue;
      }
      const wasAlreadyPaid = before.status === "paid";
      const priorValidUntil = wasAlreadyPaid ? null : player.subscriptionValidUntil ?? null;
      const verified = await db.verifyPayment(line.paymentId, adminEmail);
      if (!verified) {
        skipped.push(line.playerName);
        continue;
      }
      if (wasAlreadyPaid) {
        approved.push(player.playerName);
        continue;
      }
      const membership = getMonthlyMembershipWindow({
        paidAt: verified.paidAt ?? new Date().toISOString(),
        priorValidUntil
      });
      await db.updatePlayer(player.id, { subscriptionValidUntil: membership.endsAt });
      const parent = await db.getParentByPlayerId(player.id);
      if (parent?.email) {
        await sendPaymentApprovedEmail({
          email: parent.email,
          playerName: player.playerName,
          paymentFor: verified.paymentFor,
          amount: verified.amount,
          currency: verified.currency,
          paidAt: verified.paidAt,
          membershipStartsAt: membership.startsAt,
          membershipEndsAt: membership.endsAt
        });
      }
      approved.push(player.playerName);
    }
    revalidateAdminViews();
    const baseMsg = `Approved ${approved.length} of ${log.lineItems.length} players on the combined invoice.`;
    const tail = skipped.length ? ` Could not approve: ${skipped.join(", ")}.` : "";
    return NextResponse.json({ message: `${baseMsg}${tail}` });
  }

  let log = await getInvoiceLog(parsed.data.logId);
  if (!log) return NextResponse.json({ message: "Invoice log not found." }, { status: 404 });

  const resolved = await resolvePaymentForInvoiceLog(log);
  if (!resolved) {
    return NextResponse.json(
      {
        message:
          "Linked payment not found. This invoice log has no matching payment for this player and due date—often after a dev server restart with in-memory data. Generate a new invoice, or add the fee in the ledger first."
      },
      { status: 404 }
    );
  }
  const { payment } = resolved;
  log = resolved.log;

  const player = await db.getPlayer(log.playerId);
  const parent = player ? await db.getParentByPlayerId(player.id) : null;

  if (parsed.data.action === "send") {
    if (log.sentAt) {
      const sentLabel = new Date(log.sentAt).toLocaleString(undefined, {
        dateStyle: "full",
        timeStyle: "short"
      });
      return NextResponse.json(
        {
          code: "INVOICE_ALREADY_SENT",
          message: "This invoice was already sent to the parent.",
          sentAt: log.sentAt,
          sentAtLabel: sentLabel,
          hint: "Use “Send reminder” instead of sending the same invoice again.",
          log
        },
        { status: 409 }
      );
    }

    let emailLine = "";
    if (!parent?.email) {
      emailLine = "No parent email on file—the invoice was not emailed.";
    } else {
      const emailResult = await sendInvoiceIssuedEmail({
        email: parent.email,
        parentName: parent.parentName,
        playerName: player?.playerName ?? log.playerName,
        group: player?.ageGroup ?? log.ageGroup,
        amount: log.amount,
        currency: log.currency,
        dueDate: log.dueDate,
        description: payment.paymentFor
      });
      if ("skipped" in emailResult && emailResult.skipped) {
        emailLine =
          "Outgoing email is not configured (set RESEND_API_KEY and EMAIL_FROM in .env)—invoice is still marked as sent.";
      } else if ("failed" in emailResult && emailResult.failed) {
        emailLine = `Email could not be sent (${emailResult.error}). Invoice is still marked as sent—share the PDF manually.`;
      } else {
        emailLine = "Invoice email sent to the parent.";
      }
    }

    const next = await markInvoiceSent(log.id, adminEmail);
    if (!next) {
      return NextResponse.json({ message: "Could not update invoice log after send." }, { status: 500 });
    }
    await db.updatePayment(payment.id, { invoiceSentAt: new Date().toISOString() });
    revalidateAdminViews();
    return NextResponse.json({
      message: `${emailLine} Your PDF copy will open in a new tab.`,
      downloadUrl: log.pdfUrl,
      log: next
    });
  }

  if (parsed.data.action === "remind") {
    if (parent?.email) {
      await sendInvoicePaymentReminderEmail({
        email: parent.email,
        parentName: parent.parentName,
        playerName: player?.playerName ?? log.playerName,
        group: player?.ageGroup ?? log.ageGroup,
        amount: log.amount,
        currency: log.currency,
        dueDate: log.dueDate,
        paymentFor: payment.paymentFor,
        invoiceFirstSentAt: log.sentAt
      });
    }
    await db.updatePayment(payment.id, { invoiceSentAt: new Date().toISOString() });
    revalidateAdminViews();
    return NextResponse.json({ message: "Reminder sent." });
  }

  const wasAlreadyPaid = payment.status === "paid";
  const priorValidUntilForApprove = wasAlreadyPaid ? null : player?.subscriptionValidUntil ?? null;
  const verified = await db.verifyPayment(payment.id, adminEmail);
  if (!verified) return NextResponse.json({ message: "Payment not found." }, { status: 404 });
  if (wasAlreadyPaid) {
    revalidateAdminViews();
    return NextResponse.json({
      message: "Payment was already approved — no changes were made.",
      idempotent: true
    });
  }
  if (player) {
    const membership = getMonthlyMembershipWindow({
      paidAt: verified.paidAt ?? new Date().toISOString(),
      priorValidUntil: priorValidUntilForApprove
    });
    await db.updatePlayer(player.id, { subscriptionValidUntil: membership.endsAt });
    if (parent?.email) {
      await sendPaymentApprovedEmail({
        email: parent.email,
        playerName: player.playerName,
        paymentFor: verified.paymentFor,
        amount: verified.amount,
        currency: verified.currency,
        paidAt: verified.paidAt,
        membershipStartsAt: membership.startsAt,
        membershipEndsAt: membership.endsAt
      });
    }
  }
  revalidateAdminViews();
  return NextResponse.json({ message: "Payment approved and subscription renewed." });
}

