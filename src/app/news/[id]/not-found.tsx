import Link from "next/link";

export default function NewsArticleNotFound() {
  return (
    <div className="container page-y" style={{ textAlign: "center", maxWidth: "28rem", marginInline: "auto" }}>
      <h1 className="page-h1" style={{ fontSize: "1.5rem" }}>
        Story not found
      </h1>
      <p className="muted">This article may have been removed or the link is incorrect.</p>
      <Link href="/news" className="btn" style={{ marginTop: "1.25rem" }}>
        Back to News
      </Link>
    </div>
  );
}
