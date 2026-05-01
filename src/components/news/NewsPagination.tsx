import Link from "next/link";
import { buildPaginationItems, newsIndexHref } from "@/lib/news-page-layout";

type Props = {
  currentPage: number;
  totalPages: number;
};

export function NewsPagination({ currentPage, totalPages }: Props) {
  if (totalPages <= 1) return null;

  const items = buildPaginationItems(currentPage, totalPages);

  return (
    <nav className="news-pagination news-pagination--full" aria-label="News pagination">
      {currentPage > 1 ? (
        <Link href={newsIndexHref(currentPage - 1)} className="news-pagination__nav-btn" rel="prev">
          Previous
        </Link>
      ) : (
        <span className="news-pagination__nav-btn news-pagination__nav-btn--disabled" aria-disabled>
          Previous
        </span>
      )}

      <ul className="news-pagination__pages">
        {items.map((item, i) =>
          item.kind === "ellipsis" ? (
            <li key={`e-${i}`} className="news-pagination__ellipsis" aria-hidden>
              …
            </li>
          ) : (
            <li key={item.page}>
              {item.page === currentPage ? (
                <span className="news-pagination__page news-pagination__page--current" aria-current="page">
                  {item.page}
                </span>
              ) : (
                <Link href={newsIndexHref(item.page)} className="news-pagination__page">
                  {item.page}
                </Link>
              )}
            </li>
          )
        )}
      </ul>

      {currentPage < totalPages ? (
        <Link href={newsIndexHref(currentPage + 1)} className="news-pagination__nav-btn" rel="next">
          Next
        </Link>
      ) : (
        <span className="news-pagination__nav-btn news-pagination__nav-btn--disabled" aria-disabled>
          Next
        </span>
      )}
    </nav>
  );
}
