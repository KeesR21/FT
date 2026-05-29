"use client";

import type { SiteContent } from "@/lib/types";
import { adminApiFetch, readAdminApiError } from "@/lib/admin-api-fetch";
import { formatNetworkError } from "@/lib/api-error";
import { usePortalAuthNotify } from "@/components/portal/portal-auth-notify";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

async function readApiError(r: Response): Promise<string> {
  return readAdminApiError(r);
}

export function useAdminSiteContent() {
  const router = useRouter();
  const notify = usePortalAuthNotify();
  const [data, setData] = useState<SiteContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    const controller = new AbortController();
    const to = window.setTimeout(() => controller.abort(), 45_000);
    try {
      const r = await adminApiFetch("/api/admin/content", { signal: controller.signal });
      if (!r.ok) throw new Error(await readApiError(r));
      setData(await r.json());
    } catch (e) {
      const aborted =
        (e instanceof DOMException && e.name === "AbortError") || (e instanceof Error && e.name === "AbortError");
      if (aborted) {
        setErr("The request timed out. Check your connection and try again.");
      } else {
        setErr(formatNetworkError(e, "admin"));
      }
    } finally {
      window.clearTimeout(to);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const savePartial = useCallback(
    async (patch: Partial<SiteContent>) => {
      setSaving(true);
      setErr("");
      try {
        const r = await adminApiFetch("/api/admin/content", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch)
        });
        if (!r.ok) throw new Error(await readApiError(r));
        const next = await r.json();
        setData(next);
        router.refresh();
        return next as SiteContent;
      } catch (e) {
        setErr(formatNetworkError(e, "admin"));
        return null;
      } finally {
        setSaving(false);
      }
    },
    [router]
  );

  /**
   * Save partial content and show a toast notification on success or error.
   * Returns the updated SiteContent on success, or null on failure.
   */
  const saveWithNotify = useCallback(
    async (patch: Partial<SiteContent>, successMessage = "Saved successfully") => {
      setSaving(true);
      setErr("");
      try {
        const r = await adminApiFetch("/api/admin/content", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch)
        });
        if (!r.ok) {
          const msg = await readApiError(r);
          throw new Error(msg);
        }
        const next = await r.json();
        setData(next);
        router.refresh();
        notify.success(successMessage);
        return next as SiteContent;
      } catch (e) {
        const msg = formatNetworkError(e, "admin");
        setErr(msg);
        notify.error(msg);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [router, notify]
  );

  return { data, loading, err, setErr, saving, load, savePartial, saveWithNotify };
}
