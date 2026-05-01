import { AdminShell } from "@/components/admin/admin-shell";

/** Always render admin from live data; avoids prerendered/stale RSC payloads for dashboard and finance. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
