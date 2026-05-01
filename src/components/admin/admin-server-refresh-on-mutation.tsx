"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ADMIN_OVERVIEW_REFRESH } from "@/lib/admin-client-events";

/** Refetches server components for the active route when any admin mutation broadcasts a refresh. */
export function AdminServerRefreshOnMutation() {
  const router = useRouter();
  useEffect(() => {
    const handler = () => router.refresh();
    window.addEventListener(ADMIN_OVERVIEW_REFRESH, handler);
    return () => window.removeEventListener(ADMIN_OVERVIEW_REFRESH, handler);
  }, [router]);
  return null;
}
