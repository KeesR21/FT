export default function NewsLoading() {
  return (
    <div className="container page-y news-skeleton-page" aria-busy="true" aria-label="Loading news">
      <div className="news-skeleton news-skeleton--hero" />
      <div className="news-skeleton-row">
        <div className="news-skeleton news-skeleton--card" />
        <div className="news-skeleton news-skeleton--card" />
        <div className="news-skeleton news-skeleton--card" />
      </div>
      <div className="news-skeleton-row news-skeleton-row--wide">
        <div className="news-skeleton news-skeleton--card" />
        <div className="news-skeleton news-skeleton--card" />
      </div>
    </div>
  );
}
