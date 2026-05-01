import DOMPurify from "isomorphic-dompurify";

/** Strip tags and collapse whitespace for excerpts / previews. */
export function stripHtmlToPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function excerptFromNewsHtml(html: string, max = 160): string {
  const text = stripHtmlToPlainText(html);
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}…`;
}

/** Rough reading time for article chrome (editorial sites ~200 wpm). */
export function estimateReadingMinutesFromHtml(html: string, wordsPerMinute = 200): number {
  const words = stripHtmlToPlainText(html)
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}

function escapePlainTextForHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Legacy posts are plain text / line breaks; editor and sanitizer expect HTML. */
export function newsContentForEditor(raw: string): string {
  const t = raw?.trim() ?? "";
  if (!t) return "<p></p>";
  if (t.includes("<") && /<[a-z][\s\S]*>/i.test(t)) return t;
  const paras = t.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (paras.length === 0) return "<p></p>";
  return paras.map((p) => `<p>${escapePlainTextForHtml(p).replace(/\n/g, "<br />")}</p>`).join("");
}

/** Safe HTML for public /news and cards (trusted CMS, still sanitized). */
export function sanitizeNewsArticleHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "a",
      "ul",
      "ol",
      "li",
      "h2",
      "h3",
      "blockquote",
      "img",
      "hr",
      "div",
      "span"
    ],
    ALLOWED_ATTR: ["href", "target", "rel", "src", "alt", "class", "title"]
  });
}
