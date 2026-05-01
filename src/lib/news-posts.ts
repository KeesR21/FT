import { format, isValid, parse } from "date-fns";
import type { CmsNewsPost } from "@/lib/types";

/** Parseable instant for ordering (newest first). Missing or invalid sorts last. */
export function newsPostSortTime(p: CmsNewsPost): number {
  if (!p.publishedAt) return 0;
  const t = Date.parse(p.publishedAt);
  return Number.isNaN(t) ? 0 : t;
}

/** Ensure every post has a valid `publishedAt` (for older JSON without the field). */
export function normalizeNewsPost(p: CmsNewsPost): CmsNewsPost {
  if (p.publishedAt && !Number.isNaN(Date.parse(p.publishedAt))) return p;
  const tryParse = parse(p.date.trim(), "MMM yyyy", new Date());
  if (isValid(tryParse)) return { ...p, publishedAt: tryParse.toISOString() };
  return { ...p, publishedAt: new Date().toISOString() };
}

export function normalizeNewsPosts(posts: CmsNewsPost[]): CmsNewsPost[] {
  return posts.map(normalizeNewsPost);
}

/** Newest first; tie-break by id for stability. */
export function sortNewsPostsByPublishedDesc(posts: CmsNewsPost[]): CmsNewsPost[] {
  return [...posts].sort((a, b) => {
    const diff = newsPostSortTime(b) - newsPostSortTime(a);
    if (diff !== 0) return diff;
    return b.id.localeCompare(a.id);
  });
}

export function formatNewsDisplayDateFromIso(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return format(new Date(t), "MMM yyyy");
}

/** Value for `<input type="datetime-local" />` in local time. */
export function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Read datetime-local value to ISO string. */
export function fromDatetimeLocalValue(local: string): string {
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}
