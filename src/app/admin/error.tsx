"use client";

export default function AdminError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isDev = process.env.NODE_ENV === "development";
  return (
    <div className="admin-error-boundary">
      <div className="admin-error-boundary__inner">
        <div className="admin-error-boundary__icon" aria-hidden>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 className="admin-error-boundary__title">An error occurred</h2>
        <p className="admin-error-boundary__message">
          {isDev ? error.message : "This section encountered an unexpected error. Please try again."}
        </p>
        {isDev && error.digest ? (
          <p className="admin-error-boundary__digest">ID: {error.digest}</p>
        ) : null}
        <button type="button" className="admin-btn" onClick={() => reset()}>
          Try again
        </button>
      </div>
    </div>
  );
}
