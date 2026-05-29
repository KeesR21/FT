"use client";

import Link from "next/link";

export default function AppError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isDev = process.env.NODE_ENV === "development";

  return (
    <div className="error-page">
      <div className="error-page__inner">
        <p className="error-page__code">500</p>
        <h1 className="error-page__heading">Something went wrong</h1>
        <p className="error-page__lead">
          {isDev
            ? error.message
            : "An unexpected error occurred. Please refresh the page or try again in a moment."}
        </p>
        {isDev && error.digest ? (
          <p className="error-page__digest">Error ID: {error.digest}</p>
        ) : null}
        <div className="error-page__actions">
          <button type="button" className="btn" onClick={() => reset()}>
            Try again
          </button>
          <Link href="/" className="btn btn-secondary">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
