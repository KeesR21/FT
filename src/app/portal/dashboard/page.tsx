import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardNotifications } from "./notifications-client";
import { getKitOrderingPeriod } from "@/lib/kit-period-store";
import { listOrders } from "@/lib/kit-order-store";
import { findLinkedPlayersByEmail } from "@/lib/portal-linked-players";
import { getCurrentPortalAccount } from "@/lib/portal-auth";

export const dynamic = "force-dynamic";

export default async function PortalDashboardPage() {
  const account = await getCurrentPortalAccount();
  if (!account) redirect("/portal/login");

  const [linked, period, orders] = await Promise.all([
    findLinkedPlayersByEmail(account.email),
    getKitOrderingPeriod(),
    listOrders({ accountId: account.id })
  ]);

  const pendingOrders = orders.filter((o) => o.status === "pending_payment_approval").length;
  const approvedOrders = orders.filter((o) => o.status === "approved").length;

  return (
    <div className="portal-dashboard">
      <DashboardNotifications />

      <header className="portal-dashboard-hero">
        <div>
          <p className="portal-dashboard-eyebrow">Welcome back</p>
          <h1 className="portal-dashboard-title">Hi {account.fullName.split(" ")[0]}</h1>
          <p className="portal-dashboard-sub">
            {linked.players.length === 1
              ? `1 player is linked to your account.`
              : `${linked.players.length} players are linked to your account.`}
          </p>
        </div>
        <div className="portal-dashboard-period">
          {period.enabled ? (
            <div className="portal-period-card portal-period-card--open">
              <p className="portal-period-eyebrow">Kit ordering window</p>
              <p className="portal-period-state">OPEN</p>
              <p className="portal-period-copy">{period.announcement}</p>
            </div>
          ) : (
            <div className="portal-period-card portal-period-card--closed">
              <p className="portal-period-eyebrow">Kit ordering window</p>
              <p className="portal-period-state">CLOSED</p>
              <p className="portal-period-copy">No new orders can be submitted right now. We’ll notify you when the next window opens.</p>
            </div>
          )}
        </div>
      </header>

      <section className="portal-dashboard-stats">
        <div className="portal-stat">
          <span className="portal-stat-num">{linked.players.length}</span>
          <span className="portal-stat-label">Linked players</span>
        </div>
        <div className="portal-stat">
          <span className="portal-stat-num">{pendingOrders}</span>
          <span className="portal-stat-label">Pending orders</span>
        </div>
        <div className="portal-stat">
          <span className="portal-stat-num">{approvedOrders}</span>
          <span className="portal-stat-label">Approved orders</span>
        </div>
      </section>

      <section>
        <header className="portal-section-head">
          <h2>Your players</h2>
          <p>Open a player to place a kit order.</p>
        </header>
        {linked.players.length === 0 ? (
          <p className="portal-empty">No players linked yet — please contact the academy if this looks wrong.</p>
        ) : (
          <div className="portal-player-grid">
            {linked.players.map(({ player }) => {
              const canOrder = period.enabled && player.status === "active";
              return (
                <article key={player.id} className={`portal-player-card${player.status !== "active" ? " portal-player-card--off" : ""}`}>
                  <div className="portal-player-card-top">
                    <div className="portal-player-avatar" aria-hidden>
                      {player.playerName.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase()}
                    </div>
                    <div>
                      <h3 className="portal-player-name">{player.playerName}</h3>
                      <p className="portal-player-meta">
                        <span className="portal-chip">{player.ageGroup ?? "—"}</span>
                        {player.status === "withdrawn" ? <span className="portal-chip portal-chip--off">Withdrawn</span> : null}
                        {player.registrationStatus === "pending" ? (
                          <span className="portal-chip portal-chip--info">Application pending</span>
                        ) : null}
                      </p>
                    </div>
                  </div>
                  {canOrder ? (
                    <Link href={`/portal/order/${player.id}`} className="btn portal-btn portal-btn--primary portal-btn--block">
                      Order kit
                    </Link>
                  ) : period.enabled ? (
                    <button type="button" disabled className="btn portal-btn portal-btn--ghost portal-btn--block" title="Withdrawn players cannot place orders.">
                      Ordering unavailable
                    </button>
                  ) : (
                    <button type="button" disabled className="btn portal-btn portal-btn--ghost portal-btn--block" title="Ordering window is closed.">
                      Ordering closed
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {orders.length > 0 ? (
        <section>
          <header className="portal-section-head">
            <h2>Recent orders</h2>
            <Link href="/portal/orders" className="portal-section-link">
              View all
            </Link>
          </header>
          <ul className="portal-recent-orders">
            {orders.slice(0, 5).map((o) => (
              <li key={o.id} className={`portal-recent-order portal-recent-order--${o.status}`}>
                <div>
                  <p className="portal-recent-order-ref">{o.reference}</p>
                  <p className="portal-recent-order-meta">
                    {o.playerName} · {new Date(o.submittedAt).toLocaleDateString()}
                  </p>
                </div>
                <span className={`kit-status-pill kit-status-pill--${o.status === "pending_payment_approval" ? "pending" : o.status}`}>
                  {o.status === "pending_payment_approval"
                    ? "Pending payment"
                    : o.status === "approved"
                      ? "Approved"
                      : o.status === "rejected"
                        ? "Rejected"
                        : "Cancelled"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
