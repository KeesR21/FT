/** Shared client id for anonymous news likes/views (localStorage). */
export function getNewsEngagementClientId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem("news_engagement_cid");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("news_engagement_cid", id);
    }
    return id;
  } catch {
    return "";
  }
}

export function formatEngagementCount(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  }
  return String(n);
}
