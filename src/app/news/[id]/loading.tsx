export default function NewsArticleLoading() {
  return (
    <div className="news-article-page news-skeleton-article" aria-busy="true" aria-label="Loading article">
      <div className="news-article-page__shell">
        <div className="container news-article-page__breadcrumb">
          <div className="news-skeleton news-skeleton--line news-skeleton--short" />
        </div>
        <div className="container page-y">
          <section className="page-stack schedule-landing-stack">
            <div className="card news-article-card news-skeleton-card" aria-hidden>
              <div className="news-skeleton news-skeleton--line news-skeleton--short" />
              <div className="news-skeleton news-skeleton--line news-skeleton--title" />
              <div className="news-skeleton news-skeleton--line news-skeleton--meta" />
              <div className="news-skeleton news-skeleton--hero" />
              <div className="news-skeleton news-skeleton--block" />
              <div className="news-skeleton news-skeleton--block" />
              <div className="news-skeleton news-skeleton--block" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
