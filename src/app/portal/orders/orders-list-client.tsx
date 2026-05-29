"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";
import { SystemNotice } from "@/components/system/system-notice";
import { formatAcademyMoney } from "@/lib/finance-format";
import type { KitOrder } from "@/lib/kit-order-store";

const STATUS_LABEL: Record<KitOrder["status"], string> = {
  pending_payment_approval: "Pending payment",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled"
};

const STATUS_TONE: Record<KitOrder["status"], string> = {
  pending_payment_approval: "kit-status-pill--pending",
  approved: "kit-status-pill--approved",
  rejected: "kit-status-pill--rejected",
  cancelled: "kit-status-pill--cancelled"
};

export function OrdersListClient({
  orders,
  submittedReference
}: {
  orders: KitOrder[];
  submittedReference: string | null;
}) {
  const [showSuccess, setShowSuccess] = useState(Boolean(submittedReference));
  useEffect(() => {
    if (!submittedReference) return;
    const t = window.setTimeout(() => setShowSuccess(false), 6000);
    return () => window.clearTimeout(t);
  }, [submittedReference]);

  const formatMoney = (amount: number, currency: string) => formatAcademyMoney(amount, currency || "RWF");

  return (
    <>
      {showSuccess && submittedReference ? (
        <SystemNotice variant="success" title="Order submitted">
          Reference <strong>{submittedReference}</strong> is now Pending payment approval. We’ll notify you once payment is confirmed.
        </SystemNotice>
      ) : null}

      {orders.length === 0 ? (
        <p className="portal-empty">You haven’t placed any orders yet.</p>
      ) : (
        <div className="portal-orders-list">
          {orders.map((o) => (
            <article key={o.id} className="portal-order-card">
              <header className="portal-order-card-head">
                <div>
                  <p className="kit-order-ref">{o.reference}</p>
                  <p className="kit-order-when">
                    {o.playerName} · {new Date(o.submittedAt).toLocaleString()}
                  </p>
                </div>
                <span className={clsx("kit-status-pill", STATUS_TONE[o.status])}>{STATUS_LABEL[o.status]}</span>
              </header>
              <table className="portal-order-table">
                <thead>
                  <tr>
                    <th>Kit</th>
                    <th>Size</th>
                    <th>Qty</th>
                    <th>Line</th>
                  </tr>
                </thead>
                <tbody>
                  {o.lines.map((l, idx) => (
                    <tr key={`${o.id}-${idx}`}>
                      <td>
                        {l.kitType} <span className="kit-order-line-color">— {l.color}</span>
                      </td>
                      <td>{l.size}</td>
                      <td>{l.quantity}</td>
                      <td>{formatMoney(l.lineTotal, o.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="portal-order-card-total">
                Total: <strong>{formatMoney(o.totalAmount, o.currency)}</strong>
              </p>
              {o.status === "approved" ? (
                <p className="portal-order-card-msg portal-order-card-msg--ok">
                  Your kit order payment has been approved. We will announce the collection date soon.
                </p>
              ) : null}
              {o.status === "rejected" && o.rejectionReason ? (
                <p className="portal-order-card-msg portal-order-card-msg--bad">Reason: {o.rejectionReason}</p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
