import type { Metadata } from "next";
import type { CmsPageSeo, SiteContent } from "@/lib/types";

const SITE_NAME = "FTPR Lions Football Academy";

export function getPageSeo(content: SiteContent, slug: string): CmsPageSeo | null {
  const row = content.pageSeo?.find((p) => p.slug === slug);
  if (!row || row.status === "draft") return null;
  return row;
}

export function pageHeroFromSeo(content: SiteContent, slug: string, fallback: string): string {
  const seo = getPageSeo(content, slug);
  if (seo?.heroImage?.trim()) return seo.heroImage.trim();
  return fallback;
}

export function buildPageMetadata(content: SiteContent, slug: string, fallback?: Partial<Metadata>): Metadata {
  const seo = getPageSeo(content, slug);
  const title = seo?.title?.trim() || fallback?.title?.toString() || slug;
  const description =
    seo?.metaDescription?.trim() ||
    (typeof fallback?.description === "string" ? fallback.description : undefined) ||
    content.academyInfo;
  const ogImage = seo?.ogImage?.trim() || seo?.heroImage?.trim();

  return {
    title: typeof title === "string" && title.length > 0 ? title : fallback?.title,
    description,
    keywords: seo?.keywords?.split(",").map((k) => k.trim()).filter(Boolean),
    openGraph: ogImage
      ? { title: `${title} | ${SITE_NAME}`, description, images: [{ url: ogImage }] }
      : undefined,
    ...fallback
  };
}

/** Published CMS rows only (soft-deleted hidden). */
export function publishedOnly<T extends { status?: string; deletedAt?: string | null }>(rows: T[]): T[] {
  return rows.filter((r) => r.deletedAt == null && r.status !== "draft");
}
