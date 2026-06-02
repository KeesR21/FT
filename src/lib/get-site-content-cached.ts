import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { buildDefaultSiteContent } from "@/lib/default-site-content";
import { mergeStoredSiteContent } from "@/lib/persist-site-content";
import type { SiteContent } from "@/lib/types";

export const SITE_CONTENT_CACHE_TAG = "site-content";

const loadSiteContent = unstable_cache(
  async (): Promise<SiteContent> => {
    try {
      return await db.getSiteContent();
    } catch (err) {
      console.error("[getCachedSiteContent] DB error — using defaults:", err);
      return buildDefaultSiteContent();
    }
  },
  ["site-content-root"],
  { tags: [SITE_CONTENT_CACHE_TAG], revalidate: 120 }
);

/** Public pages: avoids hitting the DB on every navigation when CMS data is stable. */
export async function getCachedSiteContent(): Promise<SiteContent> {
  try {
    const loaded = await loadSiteContent();
    return mergeStoredSiteContent(loaded);
  } catch (err) {
    console.error("[getCachedSiteContent] Cache error — using defaults:", err);
    return buildDefaultSiteContent();
  }
}
