"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CmsAlert,
  CmsConfirmDialog,
  CmsEditorLoadFailed,
  CmsFormActions,
  CmsLoadingState,
  CmsPageHeader
} from "../../../_components/cms-shared";
import { NewsArticleEditorFields } from "../../../_components/news-article-editor-fields";
import {
  formStateFromNewsPost,
  newsPostFromFormState,
  validateNewsArticleFormState,
  type NewsArticleFormState
} from "../../../_lib/news-article-form-state";
import { useAdminSiteContent } from "../../../_lib/use-admin-site-content";
import { cmsAdminPath } from "@/lib/cms-nav";
import { normalizeNewsPosts, sortNewsPostsByPublishedDesc } from "@/lib/news-posts";

export default function AdminNewsArticleEditPage() {
  const router = useRouter();
  const params = useParams();
  const rawId = typeof params?.id === "string" ? decodeURIComponent(params.id) : "";
  const { data, loading, err, saving, saveWithNotify, load } = useAdminSiteContent();
  const [issues, setIssues] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const post = useMemo(() => {
    if (!data || !rawId) return undefined;
    return data.newsPosts.find((p) => p.id === rawId);
  }, [data, rawId]);

  const [form, setForm] = useState<NewsArticleFormState | null>(null);

  useEffect(() => {
    if (post) setForm(formStateFromNewsPost(post));
  }, [post]);

  async function onSave() {
    if (!data || !form) return;
    const v = validateNewsArticleFormState(form);
    setIssues(v);
    if (v.length > 0) return;
    const updated = newsPostFromFormState(form);
    const nextPosts = sortNewsPostsByPublishedDesc(
      normalizeNewsPosts(data.newsPosts).map((p) => (p.id === updated.id ? updated : p))
    );
    const result = await saveWithNotify(
      { newsPosts: nextPosts },
      updated.status === "draft" ? "Article saved as draft." : "Article saved successfully."
    );
    if (result) router.push(cmsAdminPath("news"));
  }

  async function executeDelete() {
    if (!data || !rawId) return;
    const nextPosts = normalizeNewsPosts(data.newsPosts).filter((p) => p.id !== rawId);
    const result = await saveWithNotify({ newsPosts: nextPosts }, "Article deleted.");
    if (result) router.push(cmsAdminPath("news"));
  }

  if (loading) return <CmsLoadingState message="Loading…" />;
  if (!data) return <CmsEditorLoadFailed err={err} load={load} />;

  if (!rawId || !post || !form) {
    return (
      <section className="page-stack cms-editor-stack cms-editor-stack--cms">
        <CmsPageHeader title="Article not found" lead="This story ID is not in the CMS." previewHref="/news" />
        <div className="card" style={{ padding: "1rem 1.1rem" }}>
          <p className="muted">
            <Link href={cmsAdminPath("news")} className="ks-text-link">
              ← Back to News editor
            </Link>
          </p>
        </div>
      </section>
    );
  }

  return (
    <>
      <CmsConfirmDialog
        open={confirmDelete}
        title="Delete article?"
        message={<>Permanently delete <strong>{post.title?.trim() || "this article"}</strong>? This cannot be undone.</>}
        confirmLabel="Delete article"
        onConfirm={() => { setConfirmDelete(false); void executeDelete(); }}
        onCancel={() => setConfirmDelete(false)}
      />

      <section className="page-stack cms-editor-stack cms-editor-stack--cms">
        <CmsPageHeader
          title="Edit article"
          lead={`Editing "${post.title?.trim() || "Untitled"}". Changes apply after you save.`}
          previewHref={`/news/${encodeURIComponent(post.id)}`}
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
          <NewsArticleEditorFields value={form} onChange={setForm} disabled={saving} issues={issues} />
          <div className="cms-form-actions" style={{ marginTop: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <button
              type="button"
              className="btn btn-secondary cms-article-delete-btn"
              disabled={saving}
              onClick={() => setConfirmDelete(true)}
            >
              Delete article
            </button>
          </div>
          <CmsFormActions
            primaryLabel={form.status === "draft" ? "Save as draft" : "Save changes"}
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
    </>
  );
}
