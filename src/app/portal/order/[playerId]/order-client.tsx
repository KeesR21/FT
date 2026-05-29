"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { SystemNotice } from "@/components/system/system-notice";
import { formatAcademyMoney } from "@/lib/finance-format";

type Kit = {
  id: string;
  type: string;
  color: string;
  description?: string;
  sizes: string[];
  price: number;
  currency: string;
  photoUrl?: string;
};

type Selection = {
  selected: boolean;
  size: string;
  quantity: number;
};

type Notice = { variant: "info" | "success" | "warning" | "error"; message: string } | null;

export function OrderClient({
  player,
  kits,
  paymentInstructions
}: {
  player: { id: string; name: string; ageGroup?: string };
  kits: Kit[];
  paymentInstructions: string;
}) {
  const router = useRouter();
  const [selections, setSelections] = useState<Record<string, Selection>>(() => {
    const map: Record<string, Selection> = {};
    for (const k of kits) {
      map[k.id] = { selected: false, size: k.sizes[0] ?? "", quantity: 1 };
    }
    return map;
  });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const submittedRef = useRef(false);

  const currency = kits[0]?.currency ?? "RWF";
  const formatMoney = (amount: number) => formatAcademyMoney(amount, currency);

  const summary = useMemo(() => {
    const lines: { kit: Kit; selection: Selection; lineTotal: number }[] = [];
    let total = 0;
    for (const kit of kits) {
      const sel = selections[kit.id];
      if (!sel?.selected) continue;
      const qty = Math.max(1, Math.floor(sel.quantity || 0));
      const lineTotal = Math.round(kit.price * qty * 100) / 100;
      total = Math.round((total + lineTotal) * 100) / 100;
      lines.push({ kit, selection: { ...sel, quantity: qty }, lineTotal });
    }
    return { lines, total };
  }, [kits, selections]);

  const update = (kitId: string, patch: Partial<Selection>) => {
    setSelections((s) => ({ ...s, [kitId]: { ...s[kitId], ...patch } }));
  };

  const submit = async () => {
    if (busy || submittedRef.current) return;
    setNotice(null);
    if (summary.lines.length === 0) {
      setNotice({ variant: "warning", message: "Select at least one kit before sending the order." });
      return;
    }
    for (const { kit, selection } of summary.lines) {
      if (!selection.size || !kit.sizes.includes(selection.size)) {
        setNotice({ variant: "warning", message: `Choose a size for "${kit.type}".` });
        return;
      }
      if (selection.quantity < 1) {
        setNotice({ variant: "warning", message: `Quantity for "${kit.type}" must be at least 1.` });
        return;
      }
    }

    submittedRef.current = true;
    setBusy(true);
    try {
      const payload = {
        playerId: player.id,
        lines: summary.lines.map(({ kit, selection }) => ({
          kitId: kit.id,
          size: selection.size,
          quantity: selection.quantity
        }))
      };
      const res = await fetch("/api/portal/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? "Could not submit order.");
      router.push(`/portal/orders?submitted=${encodeURIComponent(data.order?.reference ?? "")}`);
      router.refresh();
    } catch (err) {
      setNotice({ variant: "error", message: err instanceof Error ? err.message : "Could not submit order." });
    } finally {
      setBusy(false);
      submittedRef.current = false;
    }
  };

  return (
    <div className="portal-order">
      <header className="portal-order-hero">
        <div>
          <Link href="/portal/dashboard" className="portal-back-link">
            ← Back to dashboard
          </Link>
          <h1 className="portal-dashboard-title">Order kit for {player.name}</h1>
          {player.ageGroup ? <p className="portal-dashboard-sub">Group: {player.ageGroup}</p> : null}
        </div>
      </header>

      {kits.length === 0 ? (
        <p className="portal-empty">No kits are available right now. Please check back soon.</p>
      ) : (
        <>
          <section className="portal-order-grid">
            {kits.map((kit) => {
              const sel = selections[kit.id];
              const selected = sel?.selected ?? false;
              return (
                <article key={kit.id} className={`portal-kit-card${selected ? " portal-kit-card--selected" : ""}`}>
                  <div className="portal-kit-photo">
                    {kit.photoUrl ? (
                      <Image src={kit.photoUrl} alt={`${kit.type} ${kit.color}`} width={420} height={300} unoptimized />
                    ) : (
                      <span className="portal-kit-photo-empty">No photo</span>
                    )}
                  </div>
                  <div className="portal-kit-body">
                    <h3 className="portal-kit-title">{kit.type}</h3>
                    <p className="portal-kit-color">{kit.color}</p>
                    {kit.description ? <p className="portal-kit-desc">{kit.description}</p> : null}
                    <p className="portal-kit-price">{formatMoney(kit.price)}</p>

                    <label className="portal-kit-toggle">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) => update(kit.id, { selected: e.target.checked })}
                      />
                      <span>Add to order</span>
                    </label>

                    {selected ? (
                      <div className="portal-kit-options">
                        <label className="portal-field">
                          <span>Size</span>
                          <select value={sel.size} onChange={(e) => update(kit.id, { size: e.target.value })}>
                            {kit.sizes.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="portal-field">
                          <span>Quantity</span>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={sel.quantity}
                            onChange={(e) =>
                              update(kit.id, {
                                quantity: Math.max(1, Math.floor(Number(e.target.value) || 0))
                              })
                            }
                          />
                        </label>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </section>

          <aside className="portal-order-summary">
            <h2 className="portal-order-summary-title">Order summary</h2>
            {summary.lines.length === 0 ? (
              <p className="portal-empty">No items selected yet — pick a kit above to start.</p>
            ) : (
              <>
                <table className="portal-order-summary-table">
                  <thead>
                    <tr>
                      <th>Kit</th>
                      <th>Size</th>
                      <th>Qty</th>
                      <th>Unit</th>
                      <th>Line</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.lines.map(({ kit, selection, lineTotal }) => (
                      <tr key={kit.id}>
                        <td>
                          {kit.type} <span className="kit-order-line-color">— {kit.color}</span>
                        </td>
                        <td>{selection.size}</td>
                        <td>{selection.quantity}</td>
                        <td>{formatMoney(kit.price)}</td>
                        <td>{formatMoney(lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="portal-order-summary-total">
                  Total to pay: <strong>{formatMoney(summary.total)}</strong>
                </p>
                <div className="portal-order-instructions">
                  <p className="portal-order-instructions-title">Payment instructions</p>
                  <p>{paymentInstructions}</p>
                </div>
              </>
            )}
            {notice ? (
              <SystemNotice variant={notice.variant} title={notice.variant === "error" ? "We couldn’t submit your order" : undefined}>
                {notice.message}
              </SystemNotice>
            ) : null}
            <button
              type="button"
              className="btn portal-btn portal-btn--primary portal-btn--block"
              onClick={submit}
              disabled={busy || summary.lines.length === 0}
              aria-busy={busy}
            >
              {busy ? "Sending order…" : "Send order"}
            </button>
          </aside>
        </>
      )}
    </div>
  );
}
