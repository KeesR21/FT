"use client";

import type { SiteContent } from "@/lib/types";
import { adminApiFetch } from "@/lib/admin-api-fetch";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

async function readApiError(r: Response): Promise<string> {
  const t = await r.text();
  try {
    const j = JSON.parse(t) as { message?: string };
    if (j?.message) return j.message;
  } catch {
    /* plain */
  }
  return t || r.statusText || "Request failed";
}

export function useAdminSiteContent() {
  const router = useRouter();
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
        setErr("Request timed out. Check your connection and try again.");
      } else {
        setErr(e instanceof Error ? e.message : "Failed to load");
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
        setErr(e instanceof Error ? e.message : "Save failed");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [router]
  );

  return { data, loading, err, setErr, saving, load, savePartial };
}
