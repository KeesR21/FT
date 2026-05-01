import Image from "next/image";
import Link from "next/link";
import { NewsCardEngagement } from "@/components/news/NewsCardEngagement";

export type BlogCard = {
  /** Stable id when wiring a CMS; avoids duplicate keys when several posts share the same `href`. */
  id?: string;
  title: string;
  excerpt: string;
  href: string;
  image: string;
  /** Formatted label (e.g. "13 Apr 2026"). */
  date: string;
  publishedAt?: string;
};

type Props = {
  posts: BlogCard[];
  className?: string;
};

/** `elementskit-blog-posts` — static cards (wire to CMS later) */
export function KickstarBlogPostsGrid({ posts, className = "" }: Props) {
  return (
    <div className={`ks-w-blog-grid ${className}`.trim()}>
      {posts.map((p, index) => (
        <article
          key={p.id ?? `${p.href}::${p.title}::${p.date}::${index}`}
          className="ks-w-blog-card card"
        >
          <div className="ks-w-blog-card__media">
            <Image src={p.image} alt="" width={600} height={340} className="ks-w-blog-card__img" />
            {p.id ? <NewsCardEngagement postId={p.id} layout="home" /> : null}
          </div>
          <div className="ks-w-blog-card__body">
            <time className="muted ks-w-blog-card__time" dateTime={p.publishedAt}>
              {p.date}
            </time>
            <h3 className="ks-w-blog-card__title">
              <Link href={p.href}>{p.title}</Link>
            </h3>
            <p className="muted ks-w-blog-card__excerpt">{p.excerpt}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
