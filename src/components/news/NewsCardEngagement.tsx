"use client";

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { formatEngagementCount, getNewsEngagementClientId } from "@/lib/news-engagement-client";

function IconEye({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M12 5c-5.6 0-9.5 5.1-9.9 6 .4.9 4.3 6 9.9 6 5.6 0 9.5-5.1 9.9-6-.4-.9-4.3-6-9.9-6zm0 10a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm0-2a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"
      />
    </svg>
  );
}

function IconHeart({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg className={className} width="17" height="17" viewBox="0 0 24 24" aria-hidden>
      {filled ? (
        <path
          fill="currentColor"
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        />
      ) : (
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
        />
      )}
    </svg>
  );
}

export type NewsCardEngagementLayout = "media" | "featured" | "home";

type Props = {
  postId: string;
  layout: NewsCardEngagementLayout;
};

export function NewsCardEngagement({ postId, layout }: Props) {
  const apiUrl = useMemo(
    () => `/api/public/news/${encodeURIComponent(postId)}/engagement`,
    [postId]
  );

  const [views, setViews] = useState<number | null>(null);
  const [likes, setLikes] = useState<number | null>(null);
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const cid = getNewsEngagementClientId();
    let cancelled = false;
    const url = `${apiUrl}?clientId=${encodeURIComponent(cid)}`;
    (async () => {
      try {
        const r = await fetch(url, { credentials: "same-origin" });
        if (!r.ok) throw new Error("engagement get failed");
        const d = (await r.json()) as { views?: number; likes?: number; liked?: boolean };
        if (cancelled) return;
        setViews(typeof d.views === "number" ? d.views : 0);
        setLikes(typeof d.likes === "number" ? d.likes : 0);
        setLiked(Boolean(d.liked));
      } catch {
        if (!cancelled) {
          setViews(0);
          setLikes(0);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiUrl]);

  const onToggleLike = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (busy || likes === null) return;
      const cid = getNewsEngagementClientId();
      if (!cid) return;
      const next = !liked;
      setBusy(true);
      void (async () => {
        try {
          const r = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kind: "like", clientId: cid, like: next })
          });
          if (!r.ok) return;
          const d = (await r.json()) as { likes?: number; liked?: boolean };
          setLikes(typeof d.likes === "number" ? d.likes : 0);
          setLiked(Boolean(d.liked));
        } finally {
          setBusy(false);
        }
      })();
    },
    [apiUrl, busy, liked, likes]
  );

  const viewsLabel = views === null ? "…" : formatEngagementCount(views);
  const likesLabel = likes === null ? "…" : formatEngagementCount(likes);

  return (
    <div className={`news-card-engagement news-card-engagement--${layout}`} role="group" aria-label="Views and likes">
      <span className="news-card-engagement__stat" title="Views">
        <IconEye className="news-engagement__icon" />
        <span className="news-engagement__num">{viewsLabel}</span>
        <span className="news-engagement__label">views</span>
      </span>
      <button
        type="button"
        className={`news-engagement__like${liked ? " news-engagement__like--on" : ""}`}
        onClick={onToggleLike}
        disabled={busy || likes === null}
        aria-pressed={liked}
        aria-label={liked ? "Unlike this article" : "Like this article"}
      >
        <IconHeart filled={liked} className="news-engagement__icon" />
        <span className="news-engagement__num">{likesLabel}</span>
        <span className="news-engagement__label">likes</span>
      </button>
    </div>
  );
}
