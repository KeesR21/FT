"use client";

import clsx from "clsx";
import Image from "next/image";
import type { CmsNewsPost } from "@/lib/types";

type Props = {
  post: CmsNewsPost;
  excerpt: string;
  selected?: boolean;
  onSelect: () => void;
};

function EditArticleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L8 18l-4 1 1-4L16.5 3.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AdminNewsGridCard({ post, excerpt, selected, onSelect }: Props) {
  const src = post.image?.trim() || "/academy-1.png";
  const unopt = src.startsWith("/uploads/");
  const title = post.title?.trim() || "Untitled article";

  return (
    <button
      type="button"
      className={clsx("cms-news-admin-card", selected && "cms-news-admin-card--selected")}
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      aria-label={`Edit article: ${title}`}
    >
      <div className="cms-news-admin-card__media">
        <Image
          src={src}
          alt=""
          fill
          className="cms-news-admin-card__img"
          sizes="(max-width: 640px) 100vw, (max-width: 960px) 50vw, 320px"
          unoptimized={unopt}
        />
        <div className="cms-news-admin-card__scrim" aria-hidden />
        <div className="cms-news-admin-card__overlay">
          <span className="cms-news-admin-card__edit">
            <EditArticleIcon className="cms-news-admin-card__edit-icon" />
            Edit article
          </span>
        </div>
      </div>
      <div className="cms-news-admin-card__body">
        <h3 className="cms-news-admin-card__title">{title}</h3>
        <p className="cms-news-admin-card__excerpt">{excerpt || "—"}</p>
      </div>
    </button>
  );
}
