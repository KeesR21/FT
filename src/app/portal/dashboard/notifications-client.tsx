"use client";

import { useEffect, useRef, useState } from "react";

type Notification = {
  orderId: string;
  reference: string;
  kind: "approved" | "rejected";
  message: string;
  issuedAt: string;
};

export function DashboardNotifications() {
  const [items, setItems] = useState<Notification[]>([]);
  const dismissedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetch("/api/portal/auth/me", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.activeNotifications) return;
        setItems(d.activeNotifications as Notification[]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = async (orderId: string) => {
    if (dismissedRef.current.has(orderId)) return;
    dismissedRef.current.add(orderId);
    setItems((s) => s.filter((n) => n.orderId !== orderId));
    try {
      await fetch(`/api/portal/orders/${orderId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ acknowledgeNotification: true }),
        credentials: "include"
      });
    } catch {
      /* best effort */
    }
  };

  if (items.length === 0) return null;

  return (
    <div className="portal-notifications">
      {items.map((n) => (
        <div key={n.orderId} className={`portal-notification portal-notification--${n.kind}`} role="status" aria-live="polite">
          <div>
            <p className="portal-notification-title">
              {n.kind === "approved" ? "Order approved" : "Order rejected"} · {n.reference}
            </p>
            <p className="portal-notification-body">{n.message}</p>
          </div>
          <button type="button" className="portal-notification-dismiss" onClick={() => dismiss(n.orderId)} aria-label="Dismiss">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
