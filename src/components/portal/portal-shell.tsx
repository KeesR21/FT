"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import clsx from "clsx";
import { usePortalAuthNotify } from "@/components/portal/portal-auth-notify";
import { formatNetworkError } from "@/lib/api-error";
import { portalApiFetch, readPortalApiError } from "@/lib/portal-api-fetch";

type PortalAccount = {
  id: string;
  email: string;
  fullName: string;
  hasPassword?: boolean;
};

const NAV_LINKS = [
  { href: "/portal/dashboard", label: "Dashboard" },
  { href: "/portal/orders", label: "My orders" },
  { href: "/portal/settings", label: "Account" }
];

/**
 * Authenticated portal shell. NOTE: immersive auth routes (`/portal/login`,
 * `/portal/register`) are handled directly by `app/portal/layout.tsx` on the
 * server and never reach this component — that avoids the SSR/CSR pathname race
 * that previously caused two navbars to render briefly side-by-side.
 */
export function PortalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const notify = usePortalAuthNotify();
  const [account, setAccount] = useState<PortalAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const isAuthRoute =
    pathname === "/portal/login" ||
    pathname === "/portal/register" ||
    pathname === "/portal/forgot-password" ||
    pathname === "/portal/reset-password" ||
    pathname === "/portal";

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/portal/auth/me", { credentials: "include", cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.account) setAccount(data.account);
        else setAccount(null);
      } else {
        setAccount(null);
      }
    } catch {
      setAccount(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, pathname]);

  const logout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const res = await portalApiFetch("/api/portal/auth/logout", { method: "POST" });
      if (!res.ok) {
        notify.error(await readPortalApiError(res, { redirectOn401: false }), { status: res.status });
        setSigningOut(false);
        return;
      }
      setAccount(null);
      notify.success("Signed out successfully.", { duration: 5000 });
      window.setTimeout(() => {
        router.push("/portal/login");
        router.refresh();
        setSigningOut(false);
      }, 420);
    } catch (err) {
      notify.error(formatNetworkError(err, "portal"));
      setSigningOut(false);
    }
  };

  return (
    <div className="portal-root">
      <header className="portal-header">
        <div className="portal-header-inner">
          <Link href={account ? "/portal/dashboard" : "/portal/login"} className="portal-brand" onClick={() => setMenuOpen(false)}>
            <Image src="/logo.jpeg" alt="FTPR Lions" width={42} height={42} className="portal-brand-logo" priority />
            <div>
              <p className="portal-brand-title">FTPR Lions</p>
              <p className="portal-brand-sub">Parent portal</p>
            </div>
          </Link>

          {!isAuthRoute && account ? (
            <nav className={clsx("portal-nav", menuOpen && "portal-nav--open")} aria-label="Portal navigation">
              {NAV_LINKS.map((link) => {
                const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={clsx("portal-nav-link", active && "portal-nav-link--active")}
                    onClick={() => setMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          ) : null}

          <div className="portal-header-actions">
            {account ? (
              <>
                <span className="portal-user-pill" title={account.email}>
                  <span className="portal-user-avatar" aria-hidden>
                    {account.fullName?.[0]?.toUpperCase() ?? "P"}
                  </span>
                  <span className="portal-user-name">{account.fullName}</span>
                </span>
                <button
                  type="button"
                  className={clsx("btn portal-btn portal-btn--ghost", signingOut && "portal-btn--signout-busy")}
                  onClick={logout}
                  disabled={signingOut}
                  aria-busy={signingOut}
                >
                  {signingOut ? "Signing out…" : "Sign out"}
                </button>
              </>
            ) : !loading && pathname !== "/portal/login" && pathname !== "/portal/register" ? (
              <Link href="/portal/login" className="btn portal-btn portal-btn--primary">
                Sign in
              </Link>
            ) : null}
            {account && !isAuthRoute ? (
              <button
                type="button"
                className={clsx("portal-menu-toggle", menuOpen && "portal-menu-toggle--open")}
                aria-expanded={menuOpen}
                aria-controls="portal-mobile-nav"
                onClick={() => setMenuOpen((v) => !v)}
              >
                <span aria-hidden />
                <span aria-hidden />
                <span aria-hidden />
                <span className="visually-hidden">Toggle navigation</span>
              </button>
            ) : null}
          </div>
        </div>
      </header>
      <main id="portal-main" className="portal-main">
        {children}
      </main>
      <footer className="portal-footer">
        <p>© {new Date().getFullYear()} FTPR Lions Football Academy · Parent portal</p>
        <Link href="/" className="portal-footer-link">
          Back to public site
        </Link>
      </footer>
    </div>
  );
}
