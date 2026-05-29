import { cookies } from "next/headers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { clearAdminSession, isAdminSessionIdleExpired, touchAdminSessionActivity } from "@/lib/admin-credential-store";
import { ADMIN_COOKIE, isValidSessionToken } from "@/lib/auth";

/** Always render admin from live data; avoids prerendered/stale RSC payloads for dashboard and finance. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PUBLIC_PATHS = ["/admin/login", "/admin/forgot-password", "/admin/reset-password"];

function isAdminPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get("x-pathname") ?? "";

  if (!isAdminPublicPath(pathname)) {
    const store = await cookies();
    const token = store.get(ADMIN_COOKIE)?.value;
    if (!(await isValidSessionToken(token))) {
      // Clear the server-side session token so the cookie is rejected on every subsequent request.
      // We cannot call store.set() here (Server Component), so we rely on the token mismatch.
      if (token) await clearAdminSession();
      redirect("/admin/login?reason=timeout");
    }
    if (await isAdminSessionIdleExpired()) {
      await clearAdminSession();
      redirect("/admin/login?reason=timeout");
    }
    await touchAdminSessionActivity();
  }

  return <AdminShell>{children}</AdminShell>;
}
