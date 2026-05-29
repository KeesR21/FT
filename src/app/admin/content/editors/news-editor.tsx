"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SiteContent } from "@/lib/types";
import { excerptFromNewsHtml, stripHtmlToPlainText } from "@/lib/news-html";
import { normalizeNewsPosts, sortNewsPostsByPublishedDesc } from "@/lib/news-posts";
import {
  CmsAlert,
  CmsEditorLoadFailed,
  CmsFormActions,
  CmsLoadingState,
  CmsPageHeader,
  CmsSection
} from "../_components/cms-shared";
import { AdminNewsGridCard } from "../_components/admin-news-grid-card";
import { NewsArticleEditorFields } from "../_components/news-article-editor-fields";
import {
  formStateFromNewsPost,
  newsPostFromFormState,
  validateNewsArticleFormState,
  type NewsArticleFormState
} from "../_lib/news-article-form-state";
import { useAdminSiteContent } from "../_lib/use-admin-site-content";

const NEW_ARTICLE_HREF = "/admin/content/news/article/new";

export function NewsEditor() {
  const { data, loading, err, saving, savePartial, load } = useAdminSiteContent();
  const [newsPageTitle, setNewsPageTitle] = useState("");
  const [newsPageLead, setNewsPageLead] = useState("");
  const [posts, setPosts] = useState<SiteContent["newsPosts"]>([]);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [fieldIssues, setFieldIssues] = useState<string[]>([]);
  const [saveNotice, setSaveNotice] = useState("");
  const detailRef = useRef<HTMLDivElement>(null);

  const apply = useCallback((c: SiteContent) => {
    setNewsPageTitle(c.newsPageTitle);
    setNewsPageLead(c.newsPageLead);
    setPosts(sortNewsPostsByPublishedDesc(normalizeNewsPosts(c.newsPosts)).map((p) => ({ ...p })));
  }, []);

  useEffect(() => {
    if (data) apply(data);
  }, [data, apply]);

  useEffect(() => {
    if (selectedPostId && !posts.some((p) => p.id === selectedPostId)) {
      setSelectedPostId(null);
    }
  }, [posts, selectedPostId]);

  useEffect(() => {
    if (selectedPostId && detailRef.current) {
      detailRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedPostId]);

  const validationIssues = useMemo(() => {
    const issues: string[] = [];
    if (!newsPageTitle.trim()) issues.push("Page title is required.");
    if (!newsPageLead.trim()) issues.push("Page lead is required.");
    posts.forEach((p, idx) => {
      const n = idx + 1;
      if (!p.title.trim()) issues.push(`Article ${n}: title is required.`);
      if (!p.date.trim()) issues.push(`Article ${n}: display date is required.`);
      if (!p.image.trim()) issues.push(`Article ${n}: image is required.`);
      if (stripHtmlToPlainText(p.content).trim().length < 8) {
        issues.push(`Article ${n}: article body should be at least a short paragraph.`);
      }
    });
    return issues;
  }, [newsPageTitle, newsPageLead, posts]);

  const selectedPost = selectedPostId ? posts.find((p) => p.id === selectedPostId) : undefined;
  const detailFormState = selectedPost ? formStateFromNewsPost(selectedPost) : null;

  function updatePostFromForm(next: NewsArticleFormState) {
    setFieldIssues([]);
    const updated = newsPostFromFormState(next);
    setPosts((prev) => sortNewsPostsByPublishedDesc(prev.map((p) => (p.id === updated.id ? updated : p))));
  }

  async function saveNews() {
    if (validationIssues.length > 0) return;
    setSaveNotice("");
    const result = await savePartial({ newsPageTitle, newsPageLead, newsPosts: posts });
    if (result) setSaveNotice("News saved successfully.");
  }

  async function savePageHeaderOnly() {
    if (!newsPageTitle.trim() || !newsPageLead.trim()) return;
    setSaveNotice("");
    const result = await savePartial({ newsPageTitle, newsPageLead });
    if (result) setSaveNotice("Page header saved.");
  }

  function removeSelectedPost() {
    if (!selectedPostId) return;
    if (typeof window !== "undefined" && !window.confirm("Remove this article from the list? Save news to apply on the site.")) {
      return;
    }
    setPosts((prev) => prev.filter((p) => p.id !== selectedPostId));
    setSelectedPostId(null);
    setFieldIssues([]);
  }

  if (loading) return <CmsLoadingState message="Loading news editor…" />;

  if (!data) return <CmsEditorLoadFailed err={err} load={load} />;

  return (
    <section className="page-stack cms-editor-stack cms-editor-stack--cms">
      <CmsPageHeader
        title="News"
        lead="Page hero and articles for /news. Hover a card for actions; click to edit. Home “News & updates” shows the three newest posts. The public hub paginates ten per page."
        previewHref="/news"
      />

      {err ? (
        <CmsAlert variant="error" title="Could not save">
          {err}
        </CmsAlert>
      ) : null}
      {saveNotice ? (
        <CmsAlert variant="info" title="Saved">
          {saveNotice}
        </CmsAlert>
      ) : null}
      {validationIssues.length > 0 ? (
        <CmsAlert variant="warning" title="Fix before saving news">
          <ul>
            {validationIssues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </CmsAlert>
      ) : null}

      <CmsSection
        id="cms-news-page"
        title="Page header"
        description="Top block on /news — matches the public hero (pill styling is fixed in the theme)."
      >
        <label className="form-label">
          <span>Page title</span>
          <input className="input-field" value={newsPageTitle} onChange={(e) => setNewsPageTitle(e.target.value)} />
        </label>
        <label className="form-label">
          <span>Page lead</span>
          <textarea className="input-field" rows={2} value={newsPageLead} onChange={(e) => setNewsPageLead(e.target.value)} />
        </label>
        <CmsFormActions
          primaryLabel="Save page header"
          onPrimary={() => void savePageHeaderOnly()}
          disabled={!newsPageTitle.trim() || !newsPageLead.trim()}
          saving={saving}
        />
      </CmsSection>

      <CmsSection
        id="cms-news-posts"
        title="Articles"
        description="Same card pattern as Gallery: hover for Edit, or open a story below. Add a story with the button or the + tile. Saving writes all articles and the page header fields above are kept when you save here."
      >
        <div className="cms-gallery-albums cms-news-admin-albums">
          <div className="cms-gallery-albums__toolbar">
            <h3>Stories {posts.length > 0 ? `(${posts.length})` : ""}</h3>
            <div className="cms-news-admin-toolbar-actions">
              <Link href={NEW_ARTICLE_HREF} className="btn">
                Add article
              </Link>
            </div>
          </div>

          <div className="cms-news-admin-grid" role="list">
            {posts.map((post) => (
              <div key={post.id} role="listitem" className="cms-news-admin-grid__cell">
                <AdminNewsGridCard
                  post={post}
                  excerpt={excerptFromNewsHtml(post.content, 160)}
                  selected={selectedPostId === post.id}
                  onSelect={() => {
                    setSelectedPostId(post.id);
                    setFieldIssues([]);
                  }}
                />
              </div>
            ))}

            <div role="listitem" className="cms-news-admin-grid__cell">
              <Link
                href={NEW_ARTICLE_HREF}
                className="cms-news-admin-card cms-news-admin-card--add"
                aria-label="Create new article"
              >
                <div className="cms-news-admin-card__add-inner">
                  <span className="cms-news-admin-card__add-icon" aria-hidden>
                    +
                  </span>
                  <p className="cms-news-admin-card__add-text">New article</p>
                </div>
              </Link>
            </div>
          </div>

          {posts.length === 0 ? (
            <p className="cms-gallery-empty-hint">No articles yet. Use Add article or the tile to create one.</p>
          ) : null}
        </div>

        {selectedPost && detailFormState ? (
          <div ref={detailRef} className="cms-gallery-album-detail cms-news-admin-detail" id="news-article-detail">
            <div className="cms-gallery-album-detail__bar">
              <h3>
                Editing: {selectedPost.title?.trim() || "Untitled"}{" "}
                <span className="muted" style={{ fontWeight: 400, fontSize: "0.88em" }}>
                  (sort by publish date)
                </span>
              </h3>
              <div className="cms-gallery-album-detail__bar-actions">
                <button type="button" className="btn btn-secondary admin-btn-sm" onClick={() => setSelectedPostId(null)}>
                  ← All articles
                </button>
                <Link
                  href={`/admin/content/news/article/${encodeURIComponent(selectedPost.id)}`}
                  className="btn btn-secondary admin-btn-sm"
                >
                  Full-page edit
                </Link>
                <button type="button" className="btn btn-secondary admin-btn-sm" onClick={removeSelectedPost}>
                  Remove article
                </button>
              </div>
            </div>
            <NewsArticleEditorFields
              value={detailFormState}
              onChange={updatePostFromForm}
              disabled={saving}
              issues={fieldIssues}
            />
            <div className="cms-news-admin-detail__validate">
              <button
                type="button"
                className="btn btn-secondary admin-btn-sm"
                onClick={() => {
                  const v = validateNewsArticleFormState(detailFormState);
                  setFieldIssues(v);
                }}
                disabled={saving}
              >
                Check this article
              </button>
            </div>
          </div>
        ) : null}

        <CmsFormActions
          primaryLabel="Save news"
          onPrimary={() => void saveNews()}
          disabled={validationIssues.length > 0}
          saving={saving}
        />
        <p className="cms-field-hint muted" style={{ marginTop: "0.5rem" }}>
          Tip: open <Link href={NEW_ARTICLE_HREF}>Add article</Link> for a focused create screen, or use the + tile.
        </p>
      </CmsSection>
    </section>
  );
}
