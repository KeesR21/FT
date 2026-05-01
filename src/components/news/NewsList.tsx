import type { CmsNewsPost } from "@/lib/types";
import { NewsCard } from "./NewsCard";

type Props = {
  posts: CmsNewsPost[];
  className?: string;
};

export function NewsList({ posts, className = "" }: Props) {
  if (posts.length === 0) return null;
  return (
    <div className={`news-list ${className}`.trim()}>
      {posts.map((post) => (
        <NewsCard key={post.id} post={post} />
      ))}
    </div>
  );
}
