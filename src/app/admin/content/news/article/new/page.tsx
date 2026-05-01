"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CmsAlert,
  CmsEditorLoadFailed,
  CmsFormActions,
  CmsLoadingState,
  CmsPageHeader
} from "../../../_components/cms-shared";
import { NewsArticleEditorFields } from "../../../_components/news-article-editor-fields";
import {
  emptyNewsArticleFormState,
  newsPostFromFormState,
  validateNewsArticleFormState
} from "../../../_lib/news-article-form-state";
import { useAdminSiteContent } from "../../../_lib/use-admin-site-content";
import { cmsAdminPath } from "@/lib/cms-nav";
import { normalizeNewsPosts, sortNewsPostsByPublishedDesc } from "@/lib/news-posts";

export default function AdminNewsArticleNewPage() {
  const router = useRouter();
  const { data, loading, err, saving, savePartial, load } = useAdminSiteContent();
  const [form, setForm] = useState(() => emptyNewsArticleFormState());
  const [issues, setIssues] = useState<string[]>([]);

  async function onSave() {
    if (!data) return;
    const v = validateNewsArticleFormState(form);
    setIssues(v);
    if (v.length > 0) return;
    const post = newsPostFromFormState(form);
    const nextPosts = sortNewsPostsByPublishedDesc([post, ...normalizeNewsPosts(data.newsPosts)]);
    const result = await savePartial({ newsPosts: nextPosts });
    if (result) router.push(cmsAdminPath("news"));
  }

  if (loading) return <CmsLoadingState message="Loading…" />;
  if (!data) return <CmsEditorLoadFailed err={err} load={load} />;

  return (
    <section className="page-stack cms-editor-stack cms-editor-stack--cms">
      <CmsPageHeader
        title="New article"
        lead="Create a story for /news and the home preview strip. Publish date controls sort order (newest first)."
        previewHref="/news"
      />
      <div className="card" style={{ padding: "1rem 1.1rem" }}>
        <p className="muted" style={{ marginTop: 0 }}>
          <Link href={cmsAdminPath("news")} className="ks-text-link">
            ← Back to News editor
          </Link>
        </p>
        {err ? (
          <CmsAlert variant="error" title="Could not save">
            {err}
          </CmsAlert>
        ) : null}
        <NewsArticleEditorFields
          value={form}
          onChange={setForm}
          disabled={saving}
          issues={issues}
          syncDisplayDateOnPublishChange
        />
        <CmsFormActions
          primaryLabel="Create article"
          onPrimary={() => void onSave()}
          saving={saving}
          secondary={
            <button
              type="button"
              className="btn btn-secondary"
              disabled={saving}
              onClick={() => router.push(cmsAdminPath("news"))}
            >
              Cancel
            </button>
          }
        />
      </div>
    </section>
  );
}
