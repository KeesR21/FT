"use client";

import { useEffect } from "react";
import { ADMIN_OVERVIEW_REFRESH } from "@/lib/admin-client-events";

/** Re-run when another admin screen dispatches {@link ADMIN_OVERVIEW_REFRESH} (e.g. payment confirmed elsewhere). */
export function useAdminOverviewRefresh(onRefresh: () => void) {
  useEffect(() => {
    const handler = () => onRefresh();
    window.addEventListener(ADMIN_OVERVIEW_REFRESH, handler);
    return () => window.removeEventListener(ADMIN_OVERVIEW_REFRESH, handler);
  }, [onRefresh]);
}
