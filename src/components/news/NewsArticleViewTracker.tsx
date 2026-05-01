"use client";

import { useEffect, useMemo } from "react";
import { getNewsEngagementClientId } from "@/lib/news-engagement-client";

/** Records one view per browser session (cookie) when the article page is opened. No UI. */
export function NewsArticleViewTracker({ postId }: { postId: string }) {
  const url = useMemo(
    () => `/api/public/news/${encodeURIComponent(postId)}/engagement`,
    [postId]
  );

  useEffect(() => {
    const cid = getNewsEngagementClientId();
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ kind: "track", clientId: cid })
    }).catch(() => {});
  }, [url]);

  return null;
}
