"use client";

import { useEffect } from "react";
import { ADMIN_OVERVIEW_REFRESH, type AdminOverviewRefreshDetail } from "@/lib/admin-client-events";

/**
 * Re-run when another admin screen dispatches {@link ADMIN_OVERVIEW_REFRESH}, or when the shell's background timer
 * fires with `{ silent: true }` (no sign-out needed for new applications / notifications).
 */
export function useAdminOverviewRefresh(
  onRefresh: (detail?: AdminOverviewRefreshDetail) => void | Promise<void>
) {
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<AdminOverviewRefreshDetail>).detail;
      void Promise.resolve(onRefresh(detail));
    };
    window.addEventListener(ADMIN_OVERVIEW_REFRESH, handler as EventListener);
    return () => window.removeEventListener(ADMIN_OVERVIEW_REFRESH, handler as EventListener);
  }, [onRefresh]);
}
