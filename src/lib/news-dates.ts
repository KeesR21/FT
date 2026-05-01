/**
 * Date shown on news cards and article byline — e.g. "13 Apr 2026".
 * Prefers `publishedAt` (ISO); otherwise uses the CMS `date` string.
 */
export function formatNewsListDate(publishedAt: string | undefined, fallbackDate: string): string {
  if (publishedAt) {
    const t = Date.parse(publishedAt);
    if (!Number.isNaN(t)) {
      return new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric"
      }).format(new Date(t));
    }
  }
  const s = fallbackDate?.trim();
  return s || "—";
}
