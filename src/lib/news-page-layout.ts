import type { CmsNewsPost } from "@/lib/types";

/** Items shown on /news per page (listing cards total ≤ this on page 1 with featured + trending). */
export const NEWS_PAGE_SIZE = 10;

export type NewsPage1Layout = {
  mode: "page1";
  featured: CmsNewsPost;
  /** Up to 3 posts after the featured story */
  trending: CmsNewsPost[];
  /** Remaining slots on page 1 (newest after trending) */
  latest: CmsNewsPost[];
};

export type NewsPageOtherLayout = {
  mode: "other";
  /** Flat grid only */
  posts: CmsNewsPost[];
};

export type PaginatedNewsResult = {
  page: number;
  totalPages: number;
  totalPosts: number;
  layout: NewsPage1Layout | NewsPageOtherLayout;
};

/**
 * Page 1: featured (newest) + up to 3 “trending” + rest in “latest” grid (≤10 items total).
 * Page 2+: simple grid of 10 posts in date order.
 */
export function paginateNewsPosts(sortedNewestFirst: CmsNewsPost[], requestedPage: number): PaginatedNewsResult {
  const n = sortedNewestFirst.length;
  const totalPages = Math.max(1, Math.ceil(n / NEWS_PAGE_SIZE));
  const page = Math.min(Math.max(1, requestedPage || 1), totalPages);

  if (page === 1 && n > 0) {
    const featured = sortedNewestFirst[0];
    const trending = sortedNewestFirst.slice(1, 4);
    const latest = sortedNewestFirst.slice(4, NEWS_PAGE_SIZE);
    return {
      page,
      totalPages,
      totalPosts: n,
      layout: { mode: "page1", featured, trending, latest }
    };
  }

  const start = NEWS_PAGE_SIZE + (page - 2) * NEWS_PAGE_SIZE;
  const posts = sortedNewestFirst.slice(start, start + NEWS_PAGE_SIZE);
  return {
    page,
    totalPages,
    totalPosts: n,
    layout: { mode: "other", posts }
  };
}

/** Build /news href with stable ?page= query */
export function newsIndexHref(page: number): string {
  if (page <= 1) return "/news";
  return `/news?page=${page}`;
}

export type PaginationItem = { kind: "page"; page: number } | { kind: "ellipsis" };

/** Page numbers with ellipses between gaps (no duplicates). */
export function buildPaginationItems(current: number, total: number): PaginationItem[] {
  if (total <= 1) return [];
  const pages = new Set<number>();
  const add = (p: number) => {
    if (p >= 1 && p <= total) pages.add(p);
  };
  add(1);
  add(total);
  for (let d = -2; d <= 2; d++) add(current + d);
  const sorted = [...pages].sort((a, b) => a - b);
  const out: PaginationItem[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const n = sorted[i];
    if (i > 0 && sorted[i - 1]! < n - 1) out.push({ kind: "ellipsis" });
    out.push({ kind: "page", page: n });
  }
  return out;
}
