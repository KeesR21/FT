"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PortalAuthNotifyProvider } from "@/components/portal/portal-auth-notify";
import { useEffect, useState } from "react";
import AdminLogoutButton from "@/components/admin-logout-button";
import {
  IconBell,
  IconCalendar,
  IconCard,
  IconChart,
  IconClipboard,
  IconDashboard,
  IconFileText,
  IconInbox,
  IconMail,
  IconSearch,
  IconShirt,
  IconShoppingBag,
  IconUsers,
  IconAudit
} from "@/components/admin/admin-nav-icons";

/** Finance subsection routes (sidebar submenu). */
const FINANCE_SUBLINKS = [
  { href: "/admin/finance", label: "Overview", exact: true as const },
  { href: "/admin/finance/pricing", label: "Pricing", exact: false as const },
  { href: "/admin/finance/transactions", label: "Ledger", exact: false as const },
  { href: "/admin/finance/approvals", label: "Approvals", exact: false as const },
  { href: "/admin/finance/invoices", label: "Invoices", exact: false as const },
  { href: "/admin/finance/reports", label: "Reports", exact: false as const }
] as const;

function financeSublinkActive(pathname: string, href: string, exact: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Hrefs that are not yet live — rendered as non-clickable placeholders. */
const DISABLED_HREFS = new Set([
  "/admin/dashboard",
  "/admin/search",
  "/admin/audit",
  "/admin/activity-logs",
  "/admin/players",
  "/admin/applications",
  "/admin/communication",
  "/admin/kits",
  "/admin/kit-orders",
  "/admin/kit-orders/finance"
]);

/** Groups whose section header (label row) should also appear muted. */
const DISABLED_GROUPS = new Set(["Operations", "Finance & comms", "Kit ordering"]);
import { AdminServerRefreshOnMutation } from "@/components/admin/admin-server-refresh-on-mutation";
import { ADMIN_BACKGROUND_POLL_INTERVAL_MS, ADMIN_OVERVIEW_REFRESH } from "@/lib/admin-client-events";
import type { AdminOverviewRefreshDetail } from "@/lib/admin-client-events";
import {
  adminApiFetch,
  handleAdminSessionExpired,
  handleBackgroundAuthFailure,
  resetBackgroundAuthFailures
} from "@/lib/admin-api-fetch";
import { CMS_PAGE_LINKS, cmsAdminPath } from "@/lib/cms-nav";

const PAGE_TITLE: Record<string, string> = {
  "/admin/dashboard": "Overview",
  "/admin/players": "Players",
  "/admin/applications": "Applications",
  "/admin/finance": "Finance · Overview",
  "/admin/finance/pricing": "Finance · Pricing",
  "/admin/finance/transactions": "Finance · Ledger",
  "/admin/finance/approvals": "Finance · Approvals",
  "/admin/finance/invoices": "Finance · Invoices",
  "/admin/finance/reports": "Finance · Reports",
  "/admin/reports": "Reports",
  "/admin/communication": "Communication",
  "/admin/timetable": "Timetable",
  "/admin/content": "Content",
  "/admin/search": "Search",
  "/admin/audit": "System audit",
  "/admin/activity-logs": "Activity logs",
  "/admin/kits": "Kit management",
  "/admin/kit-orders": "Kit orders",
  "/admin/settings": "Profile & security",
  "/admin/forgot-password": "Recover access",
  "/admin/reset-password": "Set new password"
};

function financeTitle(pathname: string): string | undefined {
  if (!pathname.startsWith("/admin/finance")) return undefined;
  if (PAGE_TITLE[pathname]) return PAGE_TITLE[pathname];
  return "Finance";
}

const NAV_GROUPS = [
  {
    label: "Operations",
    items: [
      { href: "/admin/dashboard" as const, label: "Overview", Icon: IconDashboard },
      { href: "/admin/search" as const, label: "Search", Icon: IconSearch },
      { href: "/admin/audit" as const, label: "System audit", Icon: IconAudit },
      { href: "/admin/activity-logs" as const, label: "Activity logs", Icon: IconFileText },
      { href: "/admin/players" as const, label: "Players", Icon: IconUsers },
      { href: "/admin/applications" as const, label: "Applications", Icon: IconClipboard }
    ]
  },
  {
    label: "Finance & comms",
    items: [{ href: "/admin/communication" as const, label: "Messages", Icon: IconMail }]
  },
  {
    label: "Kit ordering",
    items: [
      { href: "/admin/kits" as const, label: "Kit management", Icon: IconShirt },
      { href: "/admin/kit-orders" as const, label: "Kit orders", Icon: IconShoppingBag },
      { href: "/admin/kit-orders/finance" as const, label: "Kit finances", Icon: IconChart }
    ]
  },
  {
    label: "Schedule & site",
    items: [{ href: "/admin/timetable" as const, label: "Timetable", Icon: IconCalendar }]
  }
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const bareAdminAuthRoute =
    pathname === "/admin/login" ||
    pathname === "/admin/forgot-password" ||
    pathname === "/admin/reset-password";
  const [open, setOpen] = useState(false);
  const [pendingApps, setPendingApps] = useState(0);
  const [inboxCount, setInboxCount] = useState(0);
  const [openInvoicesCount, setOpenInvoicesCount] = useState(0);
  const contentSection = pathname.startsWith("/admin/content");
  const [contentMenuOpen, setContentMenuOpen] = useState(contentSection);
  const financeSection = pathname.startsWith("/admin/finance");
  const [financeMenuOpen, setFinanceMenuOpen] = useState(financeSection);
  const [financeNavHover, setFinanceNavHover] = useState(false);

  useEffect(() => {
    if (contentSection) setContentMenuOpen(true);
  }, [contentSection]);

  useEffect(() => {
    if (financeSection) setFinanceMenuOpen(true);
  }, [financeSection]);

  const financeSubVisible = financeMenuOpen || financeNavHover;

  const cmsPageLabel = CMS_PAGE_LINKS.find((p) => pathname === cmsAdminPath(p.slug))?.label;
  const pageTitle =
    financeTitle(pathname) ??
    PAGE_TITLE[pathname] ??
    (pathname.startsWith("/admin/players/")
      ? "Player profile"
      : cmsPageLabel
        ? `Content · ${cmsPageLabel}`
        : contentSection
          ? "Content"
          : "Admin");

  useEffect(() => {
    if (bareAdminAuthRoute) return;
    let cancelled = false;
    function refreshTopbar() {
      adminApiFetch("/api/admin/summary")
        .then(async (r) => {
          if (r.status === 401) {
            // Use the resilient background handler — requires 2 consecutive
            // failures before triggering sign-out so a single transient 401
            // (file lock, hot-reload, etc.) doesn't evict an active admin.
            handleBackgroundAuthFailure();
            return null;
          }
          // Successful response resets the consecutive failure counter.
          resetBackgroundAuthFailures();
          return r.ok ? r.json() : null;
        })
        .then((d) => {
          if (cancelled || !d) return;
          if (d.pendingApplications != null) setPendingApps(Number(d.pendingApplications));
          if (d.messageCount != null) setInboxCount(Number(d.messageCount));
          if (d.openInvoicesCount != null) setOpenInvoicesCount(Number(d.openInvoicesCount));
        })
        .catch(() => {});
    }
    refreshTopbar();
    const onCustom = () => refreshTopbar();
    window.addEventListener(ADMIN_OVERVIEW_REFRESH, onCustom);
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      window.dispatchEvent(
        new CustomEvent<AdminOverviewRefreshDetail>(ADMIN_OVERVIEW_REFRESH, { detail: { silent: true } })
      );
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.removeEventListener(ADMIN_OVERVIEW_REFRESH, onCustom);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [bareAdminAuthRoute]);

  /** Background poll: badge counts + client pages using {@link useAdminOverviewRefresh} (no sign-out). */
  useEffect(() => {
    if (bareAdminAuthRoute) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      window.dispatchEvent(
        new CustomEvent<AdminOverviewRefreshDetail>(ADMIN_OVERVIEW_REFRESH, { detail: { silent: true } })
      );
    }, ADMIN_BACKGROUND_POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [bareAdminAuthRoute]);

  if (bareAdminAuthRoute) {
    return (
      <PortalAuthNotifyProvider>
        <div className="admin-auth-root">{children}</div>
      </PortalAuthNotifyProvider>
    );
  }

  return (
    <PortalAuthNotifyProvider>
      <div className="admin-root">
      <AdminServerRefreshOnMutation />
      {open ? (
        <button type="button" className="admin-sidebar-backdrop" aria-label="Close menu" onClick={() => setOpen(false)} />
      ) : null}

      <aside id="admin-sidebar" className={clsx("admin-sidebar", open && "admin-sidebar--open")}>
        <div className="admin-sidebar-brand">
          <div className="admin-sidebar-logo">
            <span className="admin-sidebar-logo-mark" aria-hidden />
            <div>
              <p className="admin-sidebar-title">FTPR Lions</p>
              <p className="admin-sidebar-sub">Academy admin</p>
            </div>
          </div>
        </div>

        <nav className="admin-nav" aria-label="Admin">
          {NAV_GROUPS.map((group) => {
            const groupDisabled = DISABLED_GROUPS.has(group.label);
            return (
              <div key={group.label} className="admin-nav-group">
                <p className={clsx("admin-nav-group-label", groupDisabled && "admin-nav-group-label--disabled")}>
                  {group.label}
                  {groupDisabled && <span className="admin-nav-group-soon" aria-hidden>Coming soon</span>}
                </p>
                <ul className="admin-nav-list">
                  {/* ── Finance accordion (Finance & comms group) ────────── */}
                  {group.label === "Finance & comms" ? (
                    <li className="admin-nav-content-wrap admin-nav-finance-wrap">
                      {/* Finance toggle — disabled: rendered as a muted span */}
                      <span
                        className="admin-nav-link admin-nav-link--disabled"
                        title="This feature is currently unavailable"
                        aria-disabled="true"
                      >
                        <span className="admin-nav-link-icon" aria-hidden>
                          <IconCard />
                        </span>
                        <span className="admin-nav-link-text">Finance</span>
                        <span className="admin-nav-lock" aria-hidden>🔒</span>
                      </span>
                    </li>
                  ) : null}

                  {/* ── Regular nav items ────────────────────────────────── */}
                  {group.items.map(({ href, label, Icon }) => {
                    const disabled = DISABLED_HREFS.has(href);
                    const active = !disabled && pathname === href;
                    if (disabled) {
                      return (
                        <li key={href}>
                          <span
                            className="admin-nav-link admin-nav-link--disabled"
                            title="This feature is currently unavailable"
                            aria-disabled="true"
                          >
                            <span className="admin-nav-link-icon" aria-hidden>
                              <Icon />
                            </span>
                            <span className="admin-nav-link-text">{label}</span>
                            <span className="admin-nav-lock" aria-hidden>🔒</span>
                          </span>
                        </li>
                      );
                    }
                    return (
                      <li key={href}>
                        <Link
                          href={href}
                          className={clsx("admin-nav-link", active && "admin-nav-link--active")}
                          onClick={() => setOpen(false)}
                        >
                          <span className="admin-nav-link-icon" aria-hidden>
                            <Icon />
                          </span>
                          <span className="admin-nav-link-text">{label}</span>
                        </Link>
                      </li>
                    );
                  })}

                  {/* ── Content accordion (Schedule & site group) ────────── */}
                  {group.label === "Schedule & site" ? (
                    <li className="admin-nav-content-wrap">
                      <button
                        type="button"
                        className={clsx(
                          "admin-nav-link admin-nav-link--toggle",
                          contentSection && "admin-nav-link--active"
                        )}
                        aria-expanded={contentMenuOpen}
                        onClick={() => setContentMenuOpen((v) => !v)}
                      >
                        <span className="admin-nav-link-icon" aria-hidden>
                          <IconFileText />
                        </span>
                        <span>Content</span>
                        <span className={`admin-nav-chevron${contentMenuOpen ? " admin-nav-chevron--open" : ""}`} aria-hidden />
                      </button>
                      {contentMenuOpen ? (
                        <ul className="admin-nav-sublist" role="list">
                          {CMS_PAGE_LINKS.map((p) => {
                            const href = cmsAdminPath(p.slug);
                            const subActive = pathname === href;
                            return (
                              <li key={p.slug}>
                                <Link
                                  href={href}
                                  className={clsx("admin-nav-sublink", subActive && "admin-nav-sublink--active")}
                                  onClick={() => setOpen(false)}
                                >
                                  {p.label}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </li>
                  ) : null}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="admin-sidebar-foot">
          <Link href="/admin/settings" className="admin-sidebar-account-link">
            Profile &amp; security
          </Link>
          <AdminLogoutButton />
        </div>
      </aside>

      <div className="admin-workspace">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button
              type="button"
              className="admin-topbar-hamburger"
              aria-expanded={open}
              aria-controls="admin-sidebar"
              onClick={() => setOpen((v) => !v)}
            >
              <span className="nav-toggle-bar" aria-hidden />
              <span className="nav-toggle-bar" aria-hidden />
              <span className="nav-toggle-bar" aria-hidden />
              <span className="visually-hidden">Open menu</span>
            </button>
            <h1 className="admin-topbar-title">{pageTitle}</h1>
          </div>

          <div className="admin-topbar-actions">
            <form className="admin-topbar-search" role="search" action="/admin/search" method="get">
              <IconSearch className="admin-topbar-search-icon" aria-hidden />
              <input
                name="q"
                type="search"
                className="admin-topbar-search-input"
                placeholder="Search players, parents…"
                aria-label="Search players and parents"
                minLength={2}
              />
            </form>
            <Link href="/admin/applications" className="admin-topbar-icon-btn" aria-label="Pending applications">
              <IconBell />
              {pendingApps > 0 ? <span className="admin-topbar-badge admin-topbar-badge--alert">{pendingApps}</span> : null}
            </Link>
            <Link href="/admin/communication" className="admin-topbar-icon-btn" aria-label="Messages">
              <IconInbox />
              {inboxCount > 0 ? (
                <span className="admin-topbar-badge admin-topbar-badge--accent">{inboxCount > 9 ? "9+" : inboxCount}</span>
              ) : null}
            </Link>
            <div className="admin-topbar-avatar" title="Staff">
              <span className="visually-hidden">Staff account</span>
              A
            </div>
          </div>
        </header>

        <div
          className={clsx(
            "admin-canvas",
            pathname === "/admin/content/home" && "admin-canvas--cms-fluid",
            financeSection && "admin-canvas--finance-wide"
          )}
        >
          <div
            className={clsx(
              "admin-main-inner",
              pathname === "/admin/content/home" && "admin-main-inner--cms-wide",
              financeSection && "admin-main-inner--finance-wide"
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
    </PortalAuthNotifyProvider>
  );
}
