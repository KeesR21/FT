import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NewsPostHtml } from "@/components/news/NewsPostHtml";
import { RelatedNews } from "@/components/news/RelatedNews";
import { NewsArticleViewTracker } from "@/components/news/NewsArticleViewTracker";
import { getCachedSiteContent } from "@/lib/get-site-content-cached";
import { formatNewsListDate } from "@/lib/news-dates";
import { excerptFromNewsHtml } from "@/lib/news-html";
import { formatPublishedTimeAgo } from "@/lib/time-ago";
import type { Metadata } from "next";
import { sortNewsPostsByPublishedDesc } from "@/lib/news-posts";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const decoded = decodeURIComponent(id);
  const c = await getCachedSiteContent();
  const post = c.newsPosts.find((p) => p.id === decoded);
  if (!post) return { title: "News" };
  return {
    title: post.title,
    description: excerptFromNewsHtml(post.content, 165)
  };
}

export default async function NewsArticlePage({ params }: Props) {
  const { id } = await params;
  const decoded = decodeURIComponent(id);
  const c = await getCachedSiteContent();
  const sorted = sortNewsPostsByPublishedDesc(c.newsPosts);
  const post = sorted.find((p) => p.id === decoded);
  if (!post) notFound();

  const related = sorted.filter((p) => p.id !== post.id).slice(0, 3);
  const authorLine = post.author?.trim();
  const unopt = post.image.startsWith("/uploads/");
  const timeAgo = formatPublishedTimeAgo(post.publishedAt, post.date);
  const displayDate = formatNewsListDate(post.publishedAt, post.date);

  return (
    <div className="news-article-page">
      <NewsArticleViewTracker postId={post.id} />
      <div className="news-article-page__shell">
        <nav className="news-article-page__breadcrumb container" aria-label="Breadcrumb">
          <ol className="news-article-breadcrumb">
            <li>
              <Link href="/">Home</Link>
            </li>
            <li aria-hidden="true" className="news-article-breadcrumb__sep">
              /
            </li>
            <li>
              <Link href="/news">News</Link>
            </li>
            <li aria-hidden="true" className="news-article-breadcrumb__sep">
              /
            </li>
            <li className="news-article-breadcrumb__current">Article</li>
          </ol>
          <Link href="/news" className="news-article-back-pill">
            ← All news
          </Link>
        </nav>

        <div className="container page-y">
          <section className="page-stack schedule-landing-stack">
            <article
              className="card news-article-card news-article news-article--story"
              itemScope
              itemType="https://schema.org/NewsArticle"
            >
              <header className="news-article__masthead">
                <p className="news-article__eyebrow">FTPR Lions · Academy bulletin</p>
                <p className="news-article__pill">News</p>
                <h1 className="news-article__title" itemProp="headline">
                  {post.title}
                </h1>
                <div className="news-article__byline">
                  <div className="news-article__byline-main">
                    {authorLine ? (
                      <span className="news-article__author" itemProp="author" itemScope itemType="https://schema.org/Person">
                        <span itemProp="name">{authorLine}</span>
                      </span>
                    ) : (
                      <span className="news-article__desk">FTPR Lions Communications</span>
                    )}
                  </div>
                  <div className="news-article__byline-meta">
                    <time className="news-article__date" dateTime={post.publishedAt} itemProp="datePublished">
                      {displayDate}
                    </time>
                    <span
                      className="news-article__time-ago"
                      title={post.publishedAt ? new Date(post.publishedAt).toLocaleString() : undefined}
                      aria-label={`Published ${timeAgo}`}
                    >
                      {timeAgo}
                    </span>
                  </div>
                </div>
                <div className="news-article__masthead-rule" aria-hidden />
              </header>

              <figure className="news-article__figure">
                <div className="news-article__figure-inner">
                  <Image
                    src={post.image}
                    alt={post.title}
                    width={1280}
                    height={720}
                    priority
                    className="news-article__hero-img"
                    sizes="(max-width: 900px) 100vw, min(920px, 92vw)"
                    unoptimized={unopt}
                  />
                </div>
                <figcaption className="news-article__caption">Figure — FTPR Lions · on-pitch and academy life</figcaption>
              </figure>

              <div className="news-article__content">
                <NewsPostHtml html={post.content} className="news-article__body" tone="article" />
              </div>

              <footer className="news-article__end">
                <Link href="/news" className="btn btn-secondary news-article__end-btn">
                  ← Back to all news
                </Link>
              </footer>
            </article>

            {related.length > 0 ? <RelatedNews posts={related} /> : null}
          </section>
        </div>
      </div>
    </div>
  );
}
