import type { CSSProperties } from "react";
import { isSameDay, parseISO } from "date-fns";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { db } from "@/lib/db";
import { resolveLedgerPaymentFor } from "@/lib/payment-guards";
import { isApprovedOnRoster, isPendingRegistration, isWithdrawnPlayer } from "@/lib/player-roster";
import { subscriptionStatusFromDate } from "@/lib/subscription-ui";
import type { Payment } from "@/lib/types";

const money = new Intl.NumberFormat("en-RW", { style: "currency", currency: "RWF" });

function monthBuckets(payments: Payment[], monthsBack: number) {
  const labels: string[] = [];
  const sums: number[] = [];
  const now = new Date();
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(d.toLocaleString("en", { month: "short" }));
    const y = d.getFullYear();
    const m = d.getMonth();
    let sum = 0;
    for (const p of payments) {
      if (p.status !== "paid" || !p.paidAt) continue;
      const pd = new Date(p.paidAt);
      if (pd.getFullYear() === y && pd.getMonth() === m) sum += p.amount;
    }
    sums.push(sum);
  }
  const max = Math.max(...sums, 1);
  return { labels, sums, max };
}

export default async function AdminDashboardPage() {
  noStore();
  const players = await db.listPlayers({ includeWithdrawn: true });
  const payments = await db.listPayments();
  const messages = await db.listMessages();
  const nameByPlayer = new Map(players.map((p) => [p.id, p.playerName]));
  const pending = players.filter(isPendingRegistration).length;
  const activePlayers = players.filter(isApprovedOnRoster).length;
  const withdrawn = players.filter(isWithdrawnPlayer).length;
  const revenue = payments.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amount, 0);
  const expiringSubs = players.filter(
    (p) => p.registrationStatus === "approved" && subscriptionStatusFromDate(p.subscriptionValidUntil) === "expiring_soon"
  ).length;
  const approvedPlayers = players.filter((p) => p.registrationStatus === "approved");
  const now = new Date();
  const membershipsDeadlineToday = approvedPlayers.filter((p) => {
    if (!p.subscriptionValidUntil) return false;
    const d = parseISO(p.subscriptionValidUntil);
    return Number.isFinite(d.getTime()) && isSameDay(d, now);
  }).length;
  const newJoinedToday = approvedPlayers.filter((p) => {
    if (!p.createdAt) return false;
    const d = parseISO(p.createdAt);
    return Number.isFinite(d.getTime()) && isSameDay(d, now);
  }).length;
  const applicationsToday = players.filter((p) => {
    if (!p.createdAt) return false;
    const d = parseISO(p.createdAt);
    return Number.isFinite(d.getTime()) && isSameDay(d, now);
  }).length;

  const { labels: barLabels, sums: barSums, max: barMax } = monthBuckets(payments, 6);

  const paidN = payments.filter((p) => p.status === "paid").length;
  const pendingN = payments.filter((p) => p.status === "pending").length;
  const overdueN = payments.filter((p) => p.status === "overdue").length;
  const openN = payments.length - paidN - overdueN - pendingN;
  const totalSeg = payments.length || 1;
  const d1 = (paidN / totalSeg) * 360;
  const d2 = d1 + ((pendingN + overdueN + openN) / totalSeg) * 360;

  const recentPayments = [...payments]
    .sort((a, b) => (b.paidAt ?? b.dueDate).localeCompare(a.paidAt ?? a.dueDate))
    .slice(0, 5)
    .map((p) => {
      const pl = players.find((x) => x.id === p.playerId);
      return {
        ...p,
        paymentFor: resolveLedgerPaymentFor(p.paymentFor, p.dueDate),
        subscriptionValidUntil: pl?.subscriptionValidUntil ?? null
      };
    });

  const activity = [
    pending > 0
      ? { dot: "amber" as const, text: `${pending} registration${pending === 1 ? "" : "s"} awaiting review.` }
      : null,
    ...messages.slice(0, 3).map((m) => ({
      dot: "blue" as const,
      text: `${m.subject} — ${m.channel === "group" ? m.ageGroup : "individual"}`
    })),
    expiringSubs > 0
      ? {
          dot: "amber" as const,
          text: `${expiringSubs} subscription${expiringSubs === 1 ? "" : "s"} expiring within 7 days.`
        }
      : null,
    withdrawn > 0
      ? {
          dot: "green" as const,
          text: `${withdrawn} withdrawn player${withdrawn === 1 ? "" : "s"} kept in archive.`
        }
      : null
  ].filter(Boolean) as { dot: "blue" | "green" | "amber"; text: string }[];

  return (
    <div className="admin-dash">
      <p className="admin-dash-intro muted" style={{ margin: "0 0 1rem", fontSize: "0.9rem" }}>
        Operations snapshot — players, registrations, payments, and subscriptions.
      </p>

      <div className="admin-dash-stats">
        <div className="admin-stat-card">
          <div className="admin-stat-card-icon admin-stat-card-icon--emerald" aria-hidden>
            RWF
          </div>
          <div className="admin-stat-card-body">
            <h3>Collected (mock)</h3>
            <p className="admin-stat-card-value">{money.format(revenue)}</p>
            <p className="admin-stat-card-trend">Paid invoices in mock data</p>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-card-icon admin-stat-card-icon--violet" aria-hidden>
            AP
          </div>
          <div className="admin-stat-card-body">
            <h3>Active players</h3>
            <p className="admin-stat-card-value">{activePlayers}</p>
            <p className="admin-stat-card-trend--muted">Approved, not withdrawn (includes lapsed subscription)</p>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-card-icon admin-stat-card-icon--sky" aria-hidden>
            PR
          </div>
          <div className="admin-stat-card-body">
            <h3>Pending applications</h3>
            <p className="admin-stat-card-value">{pending}</p>
            {pending > 0 ? (
              <Link href="/admin/applications" className="admin-stat-card-trend">
                Review now →
              </Link>
            ) : (
              <p className="admin-stat-card-trend--muted">Inbox clear</p>
            )}
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-card-icon admin-stat-card-icon--amber" aria-hidden>
            7d
          </div>
          <div className="admin-stat-card-body">
            <h3>Subs expiring (7d)</h3>
            <p className="admin-stat-card-value">{expiringSubs}</p>
            <p className="admin-stat-card-trend--muted">Renewal follow-up</p>
          </div>
        </div>
      </div>

      <div className="admin-dash-grid-2">
        <div className="admin-panel">
          <h2 className="admin-panel-title">Payment volume (paid, by month)</h2>
          <div className="admin-chart-bars" role="img" aria-label="Bar chart of paid amounts by month">
            {barSums.map((sum, i) => (
              <div key={barLabels[i]} className="admin-chart-bar-col">
                <div className="admin-chart-bar-track">
                  <div
                    className="admin-chart-bar"
                    style={{ height: `${Math.max(5, (sum / barMax) * 100)}%` }}
                    title={`${barLabels[i]}: ${money.format(sum)}`}
                  />
                </div>
                <div className="admin-chart-bar-label">{barLabels[i]}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="admin-panel">
          <h2 className="admin-panel-title">Payment status</h2>
          <div className="admin-donut-wrap">
            <div
              className="admin-donut"
              style={
                {
                  ["--d1" as string]: `${d1}deg`,
                  ["--d2" as string]: `${d2}deg`
                } as CSSProperties
              }
              role="img"
              aria-label={`Paid ${paidN}, pending ${pendingN}, overdue ${overdueN}, open ${openN}`}
            />
            <div className="admin-donut-legend">
              <span>
                <span className="admin-donut-dot" style={{ background: "#10b981" }} />
                Paid ({paidN})
              </span>
              <span>
                <span className="admin-donut-dot" style={{ background: "#fbbf24" }} />
                Pending ({pendingN})
              </span>
              <span>
                <span className="admin-donut-dot" style={{ background: "#e2e8f0" }} />
                Overdue + unpaid ({overdueN + openN})
              </span>
              <span>
                <span className="admin-donut-dot" style={{ background: "#e2e8f0" }} />
                Open / other ({openN})
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-dash-stats" style={{ marginTop: "1rem" }}>
        <div className="admin-stat-card">
          <div className="admin-stat-card-icon admin-stat-card-icon--amber" aria-hidden>
            D
          </div>
          <div className="admin-stat-card-body">
            <h3>Membership deadlines today</h3>
            <p className="admin-stat-card-value">{membershipsDeadlineToday}</p>
            <p className="admin-stat-card-trend--muted">Subscription ends on current day</p>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-card-icon admin-stat-card-icon--sky" aria-hidden>
            NJ
          </div>
          <div className="admin-stat-card-body">
            <h3>New joined today</h3>
            <p className="admin-stat-card-value">{newJoinedToday}</p>
            <p className="admin-stat-card-trend--muted">Approved players created today</p>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-card-icon admin-stat-card-icon--violet" aria-hidden>
            TA
          </div>
          <div className="admin-stat-card-body">
            <h3>Today applications</h3>
            <p className="admin-stat-card-value">{applicationsToday}</p>
            <p className="admin-stat-card-trend--muted">Registrations created today</p>
          </div>
        </div>
      </div>

      <div className="admin-dash-grid-bottom">
        <div className="admin-panel">
          <h2 className="admin-panel-title">Recent activity</h2>
          {activity.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              No recent items.
            </p>
          ) : (
            <ul className="admin-activity-list">
              {activity.map((item, i) => (
                <li key={i} className="admin-activity-item">
                  <span className={`admin-activity-dot admin-activity-dot--${item.dot}`} />
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="admin-panel admin-panel--flush">
          <div style={{ padding: "1.15rem 1.25rem 0" }}>
            <h2 className="admin-panel-title" style={{ marginBottom: 0 }}>
              Recent payments
            </h2>
          </div>
          <div className="admin-table-wrap" style={{ marginTop: 0, borderRadius: 0, borderLeft: "none", borderRight: "none" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>For</th>
                  <th>Player</th>
                  <th>Subscription ends</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.map((py) => {
                  const name = nameByPlayer.get(py.playerId) ?? "—";
                  const subEnd =
                    py.subscriptionValidUntil && py.subscriptionValidUntil.length >= 10
                      ? py.subscriptionValidUntil.slice(0, 10)
                      : "—";
                  return (
                    <tr key={py.id}>
                      <td>{py.paymentFor}</td>
                      <td>{name}</td>
                      <td>{subEnd}</td>
                      <td>
                        {money.format(py.amount)}
                      </td>
                      <td>
                        <span
                          className={`admin-badge admin-badge--${
                            py.status === "paid" ? "success" : py.status === "overdue" ? "danger" : "warn"
                          }`}
                        >
                          {py.status.replace("_", " ")}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "0.75rem 1.25rem 1rem" }}>
            <Link href="/admin/finance/transactions" className="ks-text-link admin-quick-link" style={{ color: "var(--ks-accent)" }}>
              Open finance ledger →
            </Link>
          </div>
        </div>
      </div>

      <div className="admin-panel" style={{ marginTop: "1rem" }}>
        <h2 className="admin-panel-title">Quick actions</h2>
        <div className="k-two-col card-cta-row">
          <Link href="/admin/players" className="btn">
            Player roster
          </Link>
          <Link href="/admin/timetable" className="btn btn-secondary">
            Edit timetable
          </Link>
          <Link href="/admin/communication" className="btn btn-secondary">
            Send message
          </Link>
          <Link href="/admin/reports" className="btn btn-secondary">
            Reports & exports
          </Link>
          <Link href="/admin/finance/approvals" className="btn btn-secondary">
            Pending payments
          </Link>
          <Link href="/admin/content" className="btn btn-secondary">
            Site content
          </Link>
        </div>
      </div>
    </div>
  );
}
