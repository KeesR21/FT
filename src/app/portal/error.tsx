"use client";

import Link from "next/link";

export default function PortalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isDev = process.env.NODE_ENV === "development";
  return (
    <div className="portal-error-boundary">
      <div className="portal-error-boundary__inner">
        <div className="portal-error-boundary__icon" aria-hidden>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 className="portal-error-boundary__title">Something went wrong</h2>
        <p className="portal-error-boundary__message">
          {isDev ? error.message : "An error occurred in this section. Please try again or go back to the dashboard."}
        </p>
        <div className="portal-error-boundary__actions">
          <button type="button" className="btn" onClick={() => reset()}>
            Try again
          </button>
          <Link href="/portal/dashboard" className="btn btn-secondary">
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
