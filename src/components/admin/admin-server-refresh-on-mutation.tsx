"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ADMIN_OVERVIEW_REFRESH, type AdminOverviewRefreshDetail } from "@/lib/admin-client-events";

/**
 * Refetches server components for the active route when a mutation (or explicit user action) broadcasts a refresh.
 * Skips full RSC refresh for `{ silent: true }` background polls so only client hooks + topbar summary update.
 */
export function AdminServerRefreshOnMutation() {
  const router = useRouter();
  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent<AdminOverviewRefreshDetail>).detail;
      if (d?.silent) return;
      router.refresh();
    };
    window.addEventListener(ADMIN_OVERVIEW_REFRESH, handler as EventListener);
    return () => window.removeEventListener(ADMIN_OVERVIEW_REFRESH, handler as EventListener);
  }, [router]);
  return null;
}
