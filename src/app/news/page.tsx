import type { Metadata } from "next";
import { NewsCard } from "@/components/news/NewsCard";
import { NewsList } from "@/components/news/NewsList";
import { NewsPagination } from "@/components/news/NewsPagination";
import { getCachedSiteContent } from "@/lib/get-site-content-cached";
import { paginateNewsPosts } from "@/lib/news-page-layout";
import { sortNewsPostsByPublishedDesc } from "@/lib/news-posts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "News",
  description: "Academy announcements, match reports, and updates from FTPR Lions."
};

type Props = { searchParams: Promise<{ page?: string }> };

export default async function NewsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const c = await getCachedSiteContent();
  const sorted = sortNewsPostsByPublishedDesc(c.newsPosts);
  const rawPage = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const { page, totalPages, layout } = paginateNewsPosts(sorted, rawPage);

  return (
    <div className="news-hub">
      <div className="container page-y">
        <header className="news-hub__masthead card page-hero-card">
          <span className="k-pill">BLOG & NEWS</span>
          <h1 className="page-h1">{c.newsPageTitle}</h1>
          <p className="page-lead muted">{c.newsPageLead}</p>
        </header>

        {sorted.length === 0 ? (
          <p className="news-hub__empty muted">No stories published yet. Check back soon.</p>
        ) : layout.mode === "page1" ? (
          <>
            <section className="news-hub__section news-hub__section--featured" aria-labelledby="news-latest-heading">
              <h2 id="news-latest-heading" className="news-section-title">
                Latest news
              </h2>
              <NewsCard post={layout.featured} variant="featured" priority />
            </section>

            {layout.trending.length > 0 ? (
              <section className="news-hub__section" aria-labelledby="news-trending-heading">
                <h2 id="news-trending-heading" className="news-section-title">
                  Trending now
                </h2>
                <div className="ks-w-blog-grid">
                  {layout.trending.map((post) => (
                    <NewsCard key={post.id} post={post} variant="compact" />
                  ))}
                </div>
              </section>
            ) : null}

            {layout.latest.length > 0 ? (
              <section className="news-hub__section" aria-labelledby="news-more-heading">
                <h2 id="news-more-heading" className="news-section-title">
                  More stories
                </h2>
                <NewsList posts={layout.latest} />
              </section>
            ) : null}
          </>
        ) : (
          <section className="news-hub__section" aria-labelledby="news-archive-heading">
            <h2 id="news-archive-heading" className="news-section-title">
              Latest news
            </h2>
            <NewsList posts={layout.posts} />
          </section>
        )}

        <footer className="news-hub__footer">
          <NewsPagination currentPage={page} totalPages={totalPages} />
          <p className="news-hub__page-meta muted">
            Page {page} of {totalPages}
            {sorted.length > 0 ? ` · ${sorted.length} stor${sorted.length === 1 ? "y" : "ies"}` : ""}
          </p>
        </footer>
      </div>
    </div>
  );
}
