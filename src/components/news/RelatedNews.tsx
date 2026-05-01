import type { CmsNewsPost } from "@/lib/types";
import { NewsCard } from "./NewsCard";

type Props = {
  posts: CmsNewsPost[];
};

export function RelatedNews({ posts }: Props) {
  if (posts.length === 0) return null;
  return (
    <section className="news-related" aria-labelledby="related-news-heading">
      <h2 id="related-news-heading" className="news-section-title">
        Related news
      </h2>
      <div className="news-list news-list--related">
        {posts.map((post) => (
          <NewsCard key={post.id} post={post} />
        ))}
      </div>
    </section>
  );
}
