"use client";

import { sanitizeNewsArticleHtml } from "@/lib/news-html";

/** Renders CMS article HTML safely on the public news page. */
export function NewsPostHtml({
  html,
  className = "",
  tone = "default"
}: {
  html: string;
  className?: string;
  /** `article` = full story (higher contrast); `default` = cards/previews */
  tone?: "default" | "article";
}) {
  const safe = sanitizeNewsArticleHtml(html);
  const base = tone === "article" ? "ks-news-body ks-news-body--article" : "ks-news-body muted";
  return (
    <div className={`${base}${className ? ` ${className}` : ""}`.trim()} dangerouslySetInnerHTML={{ __html: safe }} />
  );
}
