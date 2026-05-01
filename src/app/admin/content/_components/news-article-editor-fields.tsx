"use client";

import { CmsAlert, CmsImageField } from "./cms-shared";
import { NewsRichEditor } from "./news-rich-editor";
import type { NewsArticleFormState } from "../_lib/news-article-form-state";
import { excerptPreviewFromFormState } from "../_lib/news-article-form-state";
import { formatNewsDisplayDateFromIso, fromDatetimeLocalValue } from "@/lib/news-posts";

type Props = {
  value: NewsArticleFormState;
  onChange: (next: NewsArticleFormState) => void;
  disabled?: boolean;
  issues?: string[];
  /** When true, changing publish date updates the card display date to match. */
  syncDisplayDateOnPublishChange?: boolean;
};

export function NewsArticleEditorFields({
  value,
  onChange,
  disabled = false,
  issues = [],
  syncDisplayDateOnPublishChange = false
}: Props) {
  return (
    <div className="cms-news-article-fields">
      {issues.length > 0 ? (
        <CmsAlert variant="warning" title="Fix the following">
          <ul>
            {issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </CmsAlert>
      ) : null}
      <div className="form-grid-responsive admin-form-grid--2">
        <label className="form-label">
          <span>Title</span>
          <input
            className="input-field"
            value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
            placeholder="Headline for this story"
            disabled={disabled}
          />
        </label>
        <label className="form-label">
          <span>Publish date &amp; time (sort order)</span>
          <input
            type="datetime-local"
            className="input-field"
            value={value.publishedLocal}
            onChange={(e) => {
              const v = e.target.value;
              const iso = fromDatetimeLocalValue(v);
              onChange({
                ...value,
                publishedLocal: v,
                ...(syncDisplayDateOnPublishChange ? { dateDisplay: formatNewsDisplayDateFromIso(iso) } : {})
              });
            }}
            disabled={disabled}
          />
        </label>
      </div>
      <div className="form-grid-responsive admin-form-grid--2">
        <label className="form-label">
          <span>Date on card (display only)</span>
          <input
            className="input-field"
            value={value.dateDisplay}
            onChange={(e) => onChange({ ...value, dateDisplay: e.target.value })}
            placeholder="e.g. Apr 2026"
            disabled={disabled}
          />
        </label>
        <label className="form-label">
          <span>Author (optional)</span>
          <input
            className="input-field"
            value={value.author}
            onChange={(e) => onChange({ ...value, author: e.target.value })}
            placeholder="Shown on the full article page"
            disabled={disabled}
          />
        </label>
      </div>
      <CmsImageField
        label="Card image"
        value={value.image}
        onChange={(url) => onChange({ ...value, image: url })}
        usage="card"
        help="Shown above the title on /news and in the home preview row."
      />
      <p className="cms-field-hint muted" style={{ marginTop: "0.35rem" }}>
        Card excerpt preview: <em>{excerptPreviewFromFormState(value) || "…"}</em>
      </p>
      <div className="form-label" style={{ marginTop: "0.75rem" }}>
        <span>Article</span>
        <NewsRichEditor
          value={value.content}
          onChange={(html) => onChange({ ...value, content: html })}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
