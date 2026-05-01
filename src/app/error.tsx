"use client";

/**
 * Renders when a runtime error escapes the route tree (shows digest in dev via Next).
 * Helps debug opaque HTTP 500 responses during development.
 */
export default function AppError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container page-y error-shell">
      <h1 className="ks-section-h error-title">Something went wrong</h1>
      <p className="muted error-lead">
        {process.env.NODE_ENV === "development" ? error.message : "Please refresh the page or try again in a moment."}
      </p>
      {error.digest ? (
        <p className="muted error-digest">Error ID: {error.digest}</p>
      ) : null}
      <button type="button" className="btn" onClick={() => reset()}>
        Try again
      </button>
    </div>
  );
}
