import Image from "next/image";
import Link from "next/link";
import { formatNewsListDate } from "@/lib/news-dates";
import { excerptFromNewsHtml } from "@/lib/news-html";
import type { CmsNewsPost } from "@/lib/types";
import { NewsCardEngagement } from "./NewsCardEngagement";

export type NewsCardVariant = "default" | "compact" | "featured";

type Props = {
  post: CmsNewsPost;
  variant?: NewsCardVariant;
  priority?: boolean;
  excerptMax?: number;
  className?: string;
};

const unopt = (src: string) => src.startsWith("/uploads/");

export function NewsCard({ post, variant = "default", priority = false, excerptMax = 140, className = "" }: Props) {
  const excerpt = excerptFromNewsHtml(post.content, excerptMax);
  const href = `/news/${encodeURIComponent(post.id)}`;
  const titleId = `news-title-${post.id}`;
  const displayDate = formatNewsListDate(post.publishedAt, post.date);

  if (variant === "featured") {
    return (
      <article className={`news-card news-card--featured ${className}`.trim()}>
        <div className="news-card__featured-hit">
          <div className="news-card__media news-card__media--featured">
            <Link href={href} className="news-card__media-link news-card__media-link--featured" aria-labelledby={titleId}>
              <Image
                src={post.image}
                alt=""
                width={1280}
                height={560}
                priority={priority}
                loading={priority ? "eager" : "lazy"}
                className="news-card__img news-card__img--featured"
                sizes="(max-width: 900px) 100vw, min(1280px, 92vw)"
                unoptimized={unopt(post.image)}
              />
              <div className="news-card__media-overlay" aria-hidden />
            </Link>
            <NewsCardEngagement postId={post.id} layout="featured" />
          </div>
          <div className="news-card__body news-card__body--featured">
            <span className="news-card__kicker">Featured</span>
            <time className="news-card__date" dateTime={post.publishedAt}>
              {displayDate}
            </time>
            <h2 id={titleId} className="news-card__title news-card__title--featured">
              <Link href={href}>{post.title}</Link>
            </h2>
            <p className="news-card__excerpt news-card__excerpt--featured">{excerpt}</p>
            <Link href={href} className="news-card__readmore">
              Read full story →
            </Link>
          </div>
        </div>
      </article>
    );
  }

  if (variant === "compact") {
    /* Stacked “blog thumb” — same layout/classes as home `KickstarBlogPostsGrid` */
    return (
      <article className={`ks-w-blog-card card ${className}`.trim()}>
        <div className="ks-w-blog-card__media">
          <Image
            src={post.image}
            alt=""
            width={600}
            height={340}
            className="ks-w-blog-card__img"
            loading="lazy"
            unoptimized={unopt(post.image)}
          />
          <NewsCardEngagement postId={post.id} layout="home" />
        </div>
        <div className="ks-w-blog-card__body">
          <time className="muted ks-w-blog-card__time" dateTime={post.publishedAt}>
            {displayDate}
          </time>
          <h3 id={titleId} className="ks-w-blog-card__title">
            <Link href={href}>{post.title}</Link>
          </h3>
          <p className="muted ks-w-blog-card__excerpt">{excerptFromNewsHtml(post.content, 96)}</p>
        </div>
      </article>
    );
  }

  return (
    <article className={`news-card news-card--default ${className}`.trim()}>
      <div className="news-card__media">
        <Link href={href} className="news-card__media-link" aria-labelledby={titleId}>
          <Image
            src={post.image}
            alt=""
            width={640}
            height={400}
            className="news-card__img"
            sizes="(max-width: 600px) 100vw, (max-width: 1100px) 50vw, 33vw"
            loading="lazy"
            unoptimized={unopt(post.image)}
          />
        </Link>
        <NewsCardEngagement postId={post.id} layout="media" />
      </div>
      <Link href={href} className="news-card__body news-card__body--hit">
        <time className="news-card__date" dateTime={post.publishedAt}>
          {displayDate}
        </time>
        <h3 id={titleId} className="news-card__title">
          {post.title}
        </h3>
        <p className="news-card__excerpt">{excerpt}</p>
        <span className="news-card__readmore news-card__readmore--inline">Continue reading</span>
      </Link>
    </article>
  );
}
