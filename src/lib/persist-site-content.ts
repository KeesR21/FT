import fs from "fs";
import path from "path";
import { buildDefaultSiteContent } from "@/lib/default-site-content";
import { withNormalizedGallery } from "@/lib/gallery-normalize";
import { withNormalizedPitchLocations } from "@/lib/locations-normalize";
import { normalizeNewsPosts } from "@/lib/news-posts";
import type { CmsGalleryItem, SiteContent } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");
const SITE_CONTENT_FILE = path.join(DATA_DIR, "site-content.json");

function cloneSiteContent(s: SiteContent): SiteContent {
  return JSON.parse(JSON.stringify(s)) as SiteContent;
}

/** Merge saved JSON over defaults so new CMS fields added in code still have fallbacks. */
function mergeOverlay(base: SiteContent, patch: Partial<SiteContent>): SiteContent {
  const out = cloneSiteContent(base);
  for (const key of Object.keys(patch)) {
    if (!(key in out)) continue;
    const k = key as keyof SiteContent;
    const v = patch[k];
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      (out as Record<string, unknown>)[k as string] = v.map((item: unknown) =>
        item && typeof item === "object" ? { ...(item as object) } : item
      );
    } else if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      (out as Record<string, unknown>)[k as string] = {
        ...((out as Record<string, unknown>)[k as string] as object),
        ...v
      };
    } else {
      (out as Record<string, unknown>)[k as string] = v;
    }
  }
  return out;
}

/** `homeHeroImages` is logo-only; strip legacy coach* keys from merged JSON. */
function withLogoOnlyHeroImages(merged: SiteContent, base: SiteContent): SiteContent {
  const logo =
    typeof merged.homeHeroImages?.logo === "string" && merged.homeHeroImages.logo.trim()
      ? merged.homeHeroImages.logo.trim()
      : base.homeHeroImages.logo;
  return { ...merged, homeHeroImages: { logo } };
}

/** Ensure `newsPosts` have `publishedAt` for ordering (call after merges and on CMS save). */
export function withNormalizedNewsPosts(site: SiteContent): SiteContent {
  return { ...site, newsPosts: normalizeNewsPosts(site.newsPosts) };
}

/** Legacy hero elite card copy — replaced by tagline under the title. */
function withMigratedEliteCardCopy(site: SiteContent): SiteContent {
  const legacyBodies = [
    "Technical drills, match intelligence, and conditioning aligned with modern football standards.",
    "Words from football's greatest — motivation for every young Lion."
  ];
  const body = site.homeEliteBody?.trim() ?? "";
  const title = site.homeEliteTitle?.trim() ?? "";
  let homeEliteTitle = title || "Elite Training";
  let homeEliteBody = body || "Inspired by Greatness";

  if (legacyBodies.includes(body)) {
    homeEliteBody = "Inspired by Greatness";
  }
  if (title === "Game of Discipline") {
    homeEliteTitle = "Elite Training";
    homeEliteBody = "Inspired by Greatness";
  }

  return { ...site, homeEliteTitle, homeEliteBody };
}

/** Merge JSON from DB or API onto code defaults (same rules as disk merge). */
export function mergeStoredSiteContent(stored: Partial<SiteContent> | null | undefined): SiteContent {
  const base = buildDefaultSiteContent();
  if (!stored) return cloneSiteContent(base);
  const loose = stored as Partial<SiteContent> & { galleryItems?: CmsGalleryItem[] };
  let merged = mergeOverlay(base, stored);
  const hasAlbums =
    Array.isArray(loose.galleryAlbums) && loose.galleryAlbums.length > 0;
  if (!hasAlbums && loose.galleryItems && loose.galleryItems.length > 0) {
    const items = loose.galleryItems;
    merged = {
      ...merged,
      galleryAlbums: [
        {
          id: "album-legacy",
          title: "Photos",
          coverSrc: items[0].src,
          images: items.map((p) => ({ id: p.id, src: p.src }))
        }
      ]
    };
  }
  const hasPitches = Array.isArray(loose.pitchLocations) && loose.pitchLocations.length > 0;
  if (!hasPitches && loose.locationMapEmbedUrl?.trim()) {
    merged = {
      ...merged,
      pitchLocations: [
        {
          id: "pitch-legacy",
          name: "Main training site",
          address: loose.locationAddressLine?.trim() ?? merged.locationAddressLine,
          line: loose.locationAddressLine?.trim() ?? merged.locationAddressLine,
          lat: NaN,
          lng: NaN,
          mapEmbedUrl: loose.locationMapEmbedUrl.trim()
        }
      ]
    };
  }
  return withMigratedEliteCardCopy(
    withNormalizedPitchLocations(
      withNormalizedGallery(withNormalizedNewsPosts(withLogoOnlyHeroImages(merged, base)))
    )
  );
}

/** Load persisted CMS snapshot and merge onto defaults. Returns a fresh object. */
export function mergeSiteContentFromDisk(defaults: SiteContent): SiteContent {
  try {
    if (!fs.existsSync(SITE_CONTENT_FILE)) return cloneSiteContent(defaults);
    const raw = fs.readFileSync(SITE_CONTENT_FILE, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    let merged = mergeOverlay(defaults, parsed as Partial<SiteContent>);
    const hasAlbums =
      Array.isArray(parsed.galleryAlbums) && (parsed.galleryAlbums as unknown[]).length > 0;
    const legacy = parsed.galleryItems;
    if (!hasAlbums && Array.isArray(legacy) && legacy.length > 0) {
      const items = legacy as CmsGalleryItem[];
      merged = {
        ...merged,
        galleryAlbums: [
          {
            id: "album-legacy",
            title: "Photos",
            coverSrc: items[0].src,
            images: items.map((p) => ({ id: p.id, src: p.src }))
          }
        ]
      };
    }
    const hasPitches =
      Array.isArray(parsed.pitchLocations) && (parsed.pitchLocations as unknown[]).length > 0;
    const legacyMap = parsed.locationMapEmbedUrl;
    if (!hasPitches && typeof legacyMap === "string" && legacyMap.trim()) {
      const line =
        typeof parsed.locationAddressLine === "string"
          ? parsed.locationAddressLine
          : merged.locationAddressLine;
      merged = {
        ...merged,
        pitchLocations: [
          {
            id: "pitch-legacy",
            name: "Main training site",
            address: line,
            line,
            lat: NaN,
            lng: NaN,
            mapEmbedUrl: legacyMap.trim()
          }
        ]
      };
    }
    return withMigratedEliteCardCopy(
      withNormalizedPitchLocations(
        withNormalizedGallery(withNormalizedNewsPosts(withLogoOnlyHeroImages(merged, defaults)))
      )
    );
  } catch {
    return cloneSiteContent(defaults);
  }
}

/** Write full CMS snapshot to disk (survives dev server restarts). */
export function persistSiteContentSnapshot(content: SiteContent): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SITE_CONTENT_FILE, JSON.stringify(content, null, 2), "utf8");
  } catch {
    /* e.g. read-only deploy, serverless FS */
  }
}
