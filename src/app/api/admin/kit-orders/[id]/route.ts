import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedAdminActor } from "@/lib/admin-actor";
import { recordActivity } from "@/lib/activity-log";
import { sendEmail } from "@/lib/email";
import { getDeliveryStatus } from "@/lib/kit-order-finance";
import { getOrder, updateOrder } from "@/lib/kit-order-store";
import type { KitOrderDeliveryEvent } from "@/lib/kit-order-store";
import { requireAdmin } from "@/lib/require-admin";
import { revalidateAdminViews } from "@/lib/revalidate-admin";
import { jsonMessage } from "@/lib/utils";

const schema = z.object({
  action: z.enum([
    "approve",
    "reject",
    "note",
    "cancel",
    "mark_delivered",
    "mark_pending_delivery"
  ]),
  reason: z.string().trim().max(500).optional(),
  adminNotes: z.string().trim().max(1000).optional(),
  /** Optional delivery note kept on the order + audit log entry. */
  deliveryNote: z.string().trim().max(500).optional()
});

const APPROVAL_MESSAGE =
  "Your kit order payment has been approved. We will announce the collection date soon.";

function auditKitOrder(
  req: Request,
  admin: { id: string; label: string },
  orderId: string,
  description: string,
  previousValue: unknown,
  newValue: unknown
) {
  recordActivity(req, {
    actorKind: "admin",
    actorId: admin.id,
    actorLabel: admin.label,
    action: "kit_order.update",
    description,
    resourceType: "kit_order",
    resourceId: orderId,
    previousValue,
    newValue
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const adminActor = await getAuthenticatedAdminActor();
  const { id } = await ctx.params;
  const order = await getOrder(id);
  if (!order) return NextResponse.json(jsonMessage("Order not found."), { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(jsonMessage("Expected JSON body."), { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid action." },
      { status: 400 }
    );
  }

  const { action, reason, adminNotes, deliveryNote } = parsed.data;
  const actor = adminActor.label;
  const now = new Date().toISOString();

  if (action === "approve") {
    if (order.status === "approved") {
      auditKitOrder(req, adminActor, order.id, `Kit order ${order.reference}: approve (no change)`, {
        status: order.status
      }, { idempotent: true });
      return NextResponse.json({ message: "Order is already approved.", order, idempotent: true });
    }
    const priorPaid = (order.paymentRecords ?? []).reduce((s, r) => s + r.amount, 0);
    const onApproval = Math.max(0, Math.round((order.totalAmount - priorPaid) * 100) / 100);
    const paymentRecords = [
      ...(order.paymentRecords ?? []),
      ...(onApproval > 0
        ? [
            {
              id: randomUUID(),
              amount: onApproval,
              recordedAt: now,
              note: "Payment approved — balance settled",
              recordedBy: actor
            }
          ]
        : [])
    ];
    const updated = await updateOrder(order.id, {
      status: "approved",
      approvedAt: now,
      approvedBy: actor,
      adminNotes: adminNotes ?? order.adminNotes,
      paymentRecords,
      parentNotification: {
        kind: "approved",
        message: APPROVAL_MESSAGE,
        issuedAt: now
      }
    });
    if (!updated) return NextResponse.json(jsonMessage("Order not found."), { status: 404 });
    revalidateAdminViews();
    // Best-effort email to the parent (in addition to in-portal notification).
    try {
      await sendEmail(
        order.parentEmail,
        "Kit order payment approved",
        `<p>${APPROVAL_MESSAGE}</p><p>Reference: <strong>${order.reference}</strong></p>`
      );
    } catch {
      /* best effort */
    }
    auditKitOrder(req, adminActor, order.id, `Kit order ${order.reference}: payment approved`, {
      status: order.status,
      totalAmount: order.totalAmount,
      paymentRecordCount: (order.paymentRecords ?? []).length
    }, {
      status: updated.status,
      approvedAt: updated.approvedAt,
      approvedBy: updated.approvedBy,
      paymentRecordCount: (updated.paymentRecords ?? []).length
    });
    return NextResponse.json({ message: "Payment approved.", order: updated });
  }

  if (action === "reject") {
    if (order.status === "rejected") {
      auditKitOrder(req, adminActor, order.id, `Kit order ${order.reference}: reject (no change)`, {
        status: order.status
      }, { idempotent: true });
      return NextResponse.json({ message: "Order is already rejected.", order, idempotent: true });
    }
    const text = (reason ?? "").trim();
    if (!text) {
      return NextResponse.json({ message: "Please include a rejection reason." }, { status: 400 });
    }
    const updated = await updateOrder(order.id, {
      status: "rejected",
      rejectedAt: now,
      rejectedBy: actor,
      rejectionReason: text,
      adminNotes: adminNotes ?? order.adminNotes,
      parentNotification: {
        kind: "rejected",
        message: `Your kit order was not approved: ${text}`,
        issuedAt: now
      }
    });
    if (!updated) return NextResponse.json(jsonMessage("Order not found."), { status: 404 });
    revalidateAdminViews();
    auditKitOrder(req, adminActor, order.id, `Kit order ${order.reference}: rejected`, {
      status: order.status
    }, { status: updated.status, rejectedAt: updated.rejectedAt, rejectedBy: updated.rejectedBy });
    return NextResponse.json({ message: "Order rejected.", order: updated });
  }

  if (action === "cancel") {
    const updated = await updateOrder(order.id, {
      status: "cancelled",
      adminNotes: adminNotes ?? order.adminNotes
    });
    if (!updated) return NextResponse.json(jsonMessage("Order not found."), { status: 404 });
    revalidateAdminViews();
    auditKitOrder(req, adminActor, order.id, `Kit order ${order.reference}: cancelled`, { status: order.status }, {
      status: updated.status
    });
    return NextResponse.json({ message: "Order cancelled.", order: updated });
  }

  if (action === "mark_delivered") {
    if (getDeliveryStatus(order) === "delivered") {
      auditKitOrder(
        req,
        adminActor,
        order.id,
        `Kit order ${order.reference}: mark delivered (no change)`,
        { deliveryStatus: getDeliveryStatus(order) },
        { idempotent: true }
      );
      return NextResponse.json({
        message: "Order is already marked as delivered.",
        order,
        idempotent: true
      });
    }
    const event: KitOrderDeliveryEvent = {
      id: randomUUID(),
      kind: "delivered",
      at: now,
      by: actor,
      note: deliveryNote || undefined
    };
    const updated = await updateOrder(order.id, {
      deliveryStatus: "delivered",
      deliveredAt: now,
      deliveredBy: actor,
      deliveryNote: deliveryNote || order.deliveryNote,
      deliveryHistory: [...(order.deliveryHistory ?? []), event],
      adminNotes: adminNotes ?? order.adminNotes
    });
    if (!updated) return NextResponse.json(jsonMessage("Order not found."), { status: 404 });
    revalidateAdminViews();
    auditKitOrder(
      req,
      adminActor,
      order.id,
      `Kit order ${order.reference}: delivery marked delivered`,
      { deliveryStatus: getDeliveryStatus(order), deliveredAt: order.deliveredAt },
      { deliveryStatus: getDeliveryStatus(updated), deliveredAt: updated.deliveredAt, deliveredBy: updated.deliveredBy }
    );
    return NextResponse.json({ message: "Order marked as delivered.", order: updated });
  }

  if (action === "mark_pending_delivery") {
    if (getDeliveryStatus(order) === "pending") {
      auditKitOrder(
        req,
        adminActor,
        order.id,
        `Kit order ${order.reference}: pending delivery (no change)`,
        { deliveryStatus: getDeliveryStatus(order) },
        { idempotent: true }
      );
      return NextResponse.json({
        message: "Order is already pending delivery.",
        order,
        idempotent: true
      });
    }
    const event: KitOrderDeliveryEvent = {
      id: randomUUID(),
      kind: "reverted",
      at: now,
      by: actor,
      note: deliveryNote || undefined
    };
    /**
     * Keep the previous deliveredAt/deliveredBy on the audit trail (deliveryHistory) but
     * clear the live fields so the table reads as "Pending delivery". This stays auditable
     * because every prior delivery event remains in deliveryHistory.
     */
    const updated = await updateOrder(order.id, {
      deliveryStatus: "pending",
      deliveredAt: undefined,
      deliveredBy: undefined,
      deliveryNote: deliveryNote || order.deliveryNote,
      deliveryHistory: [...(order.deliveryHistory ?? []), event],
      adminNotes: adminNotes ?? order.adminNotes
    });
    if (!updated) return NextResponse.json(jsonMessage("Order not found."), { status: 404 });
    revalidateAdminViews();
    auditKitOrder(
      req,
      adminActor,
      order.id,
      `Kit order ${order.reference}: delivery reverted to pending`,
      { deliveryStatus: getDeliveryStatus(order), deliveredAt: order.deliveredAt },
      { deliveryStatus: getDeliveryStatus(updated), deliveredAt: updated.deliveredAt }
    );
    return NextResponse.json({ message: "Order reverted to pending delivery.", order: updated });
  }

  // note
  const updated = await updateOrder(order.id, { adminNotes: adminNotes ?? order.adminNotes });
  if (!updated) return NextResponse.json(jsonMessage("Order not found."), { status: 404 });
  auditKitOrder(req, adminActor, order.id, `Kit order ${order.reference}: admin note updated`, {
    adminNotesLen: (order.adminNotes ?? "").length
  }, { adminNotesLen: (updated.adminNotes ?? "").length });
  return NextResponse.json({ message: "Note saved.", order: updated });
}
