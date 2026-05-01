/**
 * Human-readable relative time from an ISO 8601 date (e.g. "20 min ago", "3 days ago").
 */
export function formatTimeAgo(iso: string, now: Date = new Date()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const then = new Date(t);
  const ms = now.getTime() - then.getTime();
  if (ms < 0) return "just now";

  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  if (sec < 45) return "just now";
  if (min < 60) return min <= 1 ? "1 min ago" : `${min} min ago`;
  if (hr < 24) return hr === 1 ? "1 hour ago" : `${hr} hours ago`;
  if (day < 7) return day === 1 ? "1 day ago" : `${day} days ago`;

  const week = Math.floor(day / 7);
  if (day < 30) return week === 1 ? "1 week ago" : `${week} weeks ago`;

  const month = Math.floor(day / 30);
  if (day < 365) return month <= 1 ? "1 month ago" : `${month} months ago`;

  const year = Math.floor(day / 365);
  return year <= 1 ? "1 year ago" : `${year} years ago`;
}

/** Same as {@link formatTimeAgo} but falls back when `iso` is missing or invalid. */
export function formatPublishedTimeAgo(iso: string | undefined, fallback: string): string {
  if (!iso) return fallback;
  const s = formatTimeAgo(iso);
  return s || fallback;
}
