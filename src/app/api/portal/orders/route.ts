import { NextResponse } from "next/server";
import { z } from "zod";
import { sendEmail } from "@/lib/email";
import {
  createOrder,
  findRecentDuplicate,
  listOrders,
  type KitOrderLine
} from "@/lib/kit-order-store";
import { getKitOrderingPeriod } from "@/lib/kit-period-store";
import { getKit } from "@/lib/kit-store";
import { findLinkedPlayersByEmail } from "@/lib/portal-linked-players";
import { requirePortalAccount } from "@/lib/require-portal";
import { revalidateAdminViews } from "@/lib/revalidate-admin";
import { formatAcademyMoney } from "@/lib/finance-format";
import { recordActivity } from "@/lib/activity-log";
import { jsonMessage } from "@/lib/utils";

const ORDER_ADMIN_EMAIL = process.env.KIT_ORDER_ADMIN_EMAIL ?? "admin@ftprlionsacademy.com";

const lineSchema = z.object({
  kitId: z.string().min(1),
  size: z.string().trim().min(1),
  quantity: z.number().int().min(1).max(99)
});

const createSchema = z.object({
  playerId: z.string().min(1),
  lines: z.array(lineSchema).min(1, "Add at least one kit to the order.")
});

export async function GET() {
  const gate = await requirePortalAccount();
  if (!gate.ok) return gate.response;
  const orders = await listOrders({ accountId: gate.account.id });
  return NextResponse.json({ orders });
}

export async function POST(req: Request) {
  const gate = await requirePortalAccount();
  if (!gate.ok) return gate.response;
  const { account } = gate;

  const period = await getKitOrderingPeriod();
  if (!period.enabled) {
    return NextResponse.json(
      { message: "Kit ordering is currently closed. Please check back when the next ordering window opens." },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(jsonMessage("Expected JSON body."), { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid order." },
      { status: 400 }
    );
  }

  const linked = await findLinkedPlayersByEmail(account.email);
  const target = linked.players.find((lp) => lp.player.id === parsed.data.playerId);
  if (!target) {
    return NextResponse.json(
      { message: "That player is not linked to your account." },
      { status: 403 }
    );
  }
  if (target.player.status === "withdrawn") {
    return NextResponse.json(
      { message: "Orders cannot be placed for withdrawn players." },
      { status: 400 }
    );
  }

  // Resolve every kit line, validate active + size + quantity, capture price snapshot.
  const resolvedLines: KitOrderLine[] = [];
  let total = 0;
  let currency = "XAF";
  for (const line of parsed.data.lines) {
    if (line.quantity < 1) {
      return NextResponse.json(
        { message: "Selected kits must have a quantity of at least 1." },
        { status: 400 }
      );
    }
    const kit = await getKit(line.kitId);
    if (!kit) {
      return NextResponse.json({ message: `One of the selected kits is no longer available.` }, { status: 400 });
    }
    if (!kit.active) {
      return NextResponse.json(
        { message: `The kit "${kit.type}" is no longer available for ordering.` },
        { status: 400 }
      );
    }
    if (!kit.sizes.includes(line.size)) {
      return NextResponse.json(
        { message: `The size "${line.size}" is not available for "${kit.type}".` },
        { status: 400 }
      );
    }
    const lineTotal = round2(kit.price * line.quantity);
    total = round2(total + lineTotal);
    currency = kit.currency || currency;
    resolvedLines.push({
      kitId: kit.id,
      kitType: kit.type,
      color: kit.color,
      size: line.size,
      quantity: line.quantity,
      unitPrice: kit.price,
      lineTotal,
      photoUrl: kit.photoUrl
    });
  }

  // Anti-duplicate guard for double-clicks / refresh-then-resubmit.
  const dupe = await findRecentDuplicate({
    accountId: account.id,
    playerId: target.player.id,
    totalAmount: total
  });
  if (dupe) {
    return NextResponse.json(
      {
        message: "We already received this order a moment ago. Please check your orders list.",
        orderId: dupe.id,
        reference: dupe.reference
      },
      { status: 409 }
    );
  }

  const order = await createOrder({
    accountId: account.id,
    parentName: account.fullName,
    parentEmail: account.email,
    parentPhone: target.parent.phoneNumber,
    playerId: target.player.id,
    playerName: target.player.playerName,
    playerGroup: target.player.ageGroup,
    lines: resolvedLines,
    totalAmount: total,
    currency
  });

  revalidateAdminViews();

  recordActivity(req, {
    actorKind: "parent",
    actorId: account.id,
    actorLabel: account.email,
    action: "portal.order.create",
    description: `Submitted kit order ${order.reference} for ${order.playerName} (${formatAcademyMoney(order.totalAmount, order.currency)})`,
    resourceType: "kit_order",
    resourceId: order.id,
    newValue: {
      reference: order.reference,
      playerId: order.playerId,
      totalAmount: order.totalAmount,
      currency: order.currency,
      lineCount: order.lines.length
    }
  });

  // Best-effort admin notification email.
  try {
    await sendEmail(
      ORDER_ADMIN_EMAIL,
      "New Kit Order Application Submitted",
      buildAdminOrderEmailHtml({
        order,
        adminUrl: `${getOrigin(req)}/admin/kit-orders`
      })
    );
  } catch (e) {
    console.error("Admin order email failed:", e);
  }

  return NextResponse.json({ message: "Order submitted.", order });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function getOrigin(req: Request): string {
  try {
    return new URL(req.url).origin;
  } catch {
    return "";
  }
}

function buildAdminOrderEmailHtml(input: { order: Awaited<ReturnType<typeof createOrder>>; adminUrl: string }) {
  const { order, adminUrl } = input;
  const fmt = (n: number) => formatAcademyMoney(n, order.currency || "RWF");
  const rows = order.lines
    .map(
      (l) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee">${escapeHtml(l.kitType)} — ${escapeHtml(l.color)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee">${escapeHtml(l.size)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">${l.quantity}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">${fmt(l.unitPrice)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">${fmt(l.lineTotal)}</td>
        </tr>`
    )
    .join("");

  return `
    <div style="font-family:Inter,Arial,sans-serif;color:#0f172a;max-width:640px;margin:0 auto">
      <h2 style="color:#0b3a82;margin:0 0 8px">New Kit Order — ${escapeHtml(order.reference)}</h2>
      <p style="margin:0 0 16px;color:#475569">Submitted ${new Date(order.submittedAt).toLocaleString()}</p>
      <table style="border-collapse:collapse;width:100%;margin-bottom:16px">
        <tr><td style="padding:6px 0;color:#475569">Parent</td><td style="padding:6px 0"><strong>${escapeHtml(order.parentName)}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#475569">Email</td><td style="padding:6px 0">${escapeHtml(order.parentEmail)}</td></tr>
        ${order.parentPhone ? `<tr><td style="padding:6px 0;color:#475569">Phone</td><td style="padding:6px 0">${escapeHtml(order.parentPhone)}</td></tr>` : ""}
        <tr><td style="padding:6px 0;color:#475569">Player</td><td style="padding:6px 0">${escapeHtml(order.playerName)}${order.playerGroup ? ` <span style="color:#475569">(${escapeHtml(order.playerGroup)})</span>` : ""}</td></tr>
      </table>
      <table style="border-collapse:collapse;width:100%;border:1px solid #eee">
        <thead>
          <tr style="background:#f8fafc">
            <th style="text-align:left;padding:8px 12px;border-bottom:1px solid #eee">Kit</th>
            <th style="text-align:left;padding:8px 12px;border-bottom:1px solid #eee">Size</th>
            <th style="text-align:right;padding:8px 12px;border-bottom:1px solid #eee">Qty</th>
            <th style="text-align:right;padding:8px 12px;border-bottom:1px solid #eee">Unit</th>
            <th style="text-align:right;padding:8px 12px;border-bottom:1px solid #eee">Line</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin:12px 0 0;text-align:right;font-size:18px"><strong>Total: ${fmt(order.totalAmount)}</strong></p>
      <p style="margin:24px 0 0">
        <a href="${adminUrl}" style="background:#0b3a82;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">Review in admin</a>
      </p>
    </div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;"
  );
}
