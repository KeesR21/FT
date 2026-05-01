import { excerptFromNewsHtml, stripHtmlToPlainText } from "@/lib/news-html";
import type { CmsNewsPost } from "@/lib/types";
import {
  formatNewsDisplayDateFromIso,
  fromDatetimeLocalValue,
  normalizeNewsPost,
  toDatetimeLocalValue
} from "@/lib/news-posts";

export type NewsArticleFormState = {
  id: string;
  title: string;
  content: string;
  image: string;
  publishedLocal: string;
  dateDisplay: string;
  author: string;
};

export function emptyNewsArticleFormState(): NewsArticleFormState {
  const iso = new Date().toISOString();
  return {
    id: `nw-${Date.now()}`,
    title: "",
    content: "<p>Start writing your article here.</p>",
    image: "/academy-1.png",
    publishedLocal: toDatetimeLocalValue(iso),
    dateDisplay: formatNewsDisplayDateFromIso(iso),
    author: ""
  };
}

export function formStateFromNewsPost(p: CmsNewsPost): NewsArticleFormState {
  const norm = normalizeNewsPost(p);
  return {
    id: p.id,
    title: p.title,
    content: p.content,
    image: p.image,
    publishedLocal: toDatetimeLocalValue(norm.publishedAt ?? new Date().toISOString()),
    dateDisplay: p.date,
    author: p.author ?? ""
  };
}

export function newsPostFromFormState(s: NewsArticleFormState): CmsNewsPost {
  const publishedAt = fromDatetimeLocalValue(s.publishedLocal);
  return {
    id: s.id.trim(),
    title: s.title.trim(),
    content: s.content,
    image: s.image.trim(),
    date: s.dateDisplay.trim(),
    publishedAt,
    ...(s.author.trim() ? { author: s.author.trim() } : {})
  };
}

export function validateNewsArticleFormState(s: NewsArticleFormState): string[] {
  const issues: string[] = [];
  if (!s.title.trim()) issues.push("Title is required.");
  if (!s.dateDisplay.trim()) issues.push("Display date is required.");
  if (!s.image.trim()) issues.push("Card image is required.");
  if (!s.publishedLocal.trim()) issues.push("Publish date & time is required for ordering.");
  if (stripHtmlToPlainText(s.content).trim().length < 8) {
    issues.push("Article body should be at least a short paragraph.");
  }
  return issues;
}

export function excerptPreviewFromFormState(s: NewsArticleFormState, maxLen = 140): string {
  return excerptFromNewsHtml(s.content, maxLen);
}
