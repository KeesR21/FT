import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import type { SiteContent } from "@/lib/types";

export const SITE_CONTENT_CACHE_TAG = "site-content";

const loadSiteContent = unstable_cache(
  async (): Promise<SiteContent> => db.getSiteContent(),
  ["site-content-root"],
  { tags: [SITE_CONTENT_CACHE_TAG], revalidate: 120 }
);

/** Public pages: avoids hitting the DB on every navigation when CMS data is stable. */
export function getCachedSiteContent(): Promise<SiteContent> {
  return loadSiteContent();
}
