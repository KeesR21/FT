import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Navbar from "@/components/navbar";
import { PortalAuthNotifyProvider } from "@/components/portal/portal-auth-notify";
import { PortalShell } from "@/components/portal/portal-shell";
import { clearSessionToken, isPortalAccountIdleExpired, touchPortalAccountActivity } from "@/lib/parent-account-store";
import { getCurrentPortalAccount } from "@/lib/portal-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Server-side route branching. Auth screens (`/portal/login`, `/portal/register`)
 * use the public `Navbar` only — no `PortalShell` — so there's never a moment where
 * the SSR portal header and the client immersive header are both in the DOM (which
 * was producing the "double menu" the user reported).
 */
export default async function PortalLayout({ children }: { children: ReactNode }) {
  const h = await headers();
  const pathname = h.get("x-pathname") ?? "";
  const isImmersiveAuth =
    pathname === "/portal/login" ||
    pathname === "/portal/register" ||
    pathname === "/portal/forgot-password" ||
    pathname === "/portal/reset-password";

  const needsPortalSession =
    !isImmersiveAuth &&
    (pathname.startsWith("/portal/dashboard") ||
      pathname.startsWith("/portal/settings") ||
      pathname.startsWith("/portal/orders") ||
      pathname.startsWith("/portal/order"));

  if (needsPortalSession) {
    const account = await getCurrentPortalAccount();
    if (!account) {
      // Server Component — cannot call store.set(). The token mismatch on the next
      // request will reject the cookie; just redirect immediately.
      redirect("/portal/login?reason=timeout");
    }
    if (isPortalAccountIdleExpired(account)) {
      await clearSessionToken(account.id);
      redirect("/portal/login?reason=timeout");
    }
    await touchPortalAccountActivity(account.id);
  }

  const inner = isImmersiveAuth ? (
    <div className="portal-root portal-root--immersive">
      <div className="portal-immersive-nav">
        <Navbar />
      </div>
      <main id="portal-main" className="portal-main portal-main--immersive">
        {children}
      </main>
    </div>
  ) : (
    <PortalShell>{children}</PortalShell>
  );

  return <PortalAuthNotifyProvider>{inner}</PortalAuthNotifyProvider>;
}
