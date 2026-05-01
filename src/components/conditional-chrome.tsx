"use client";

import Footer from "@/components/footer";
import Navbar from "@/components/navbar";

/**
 * Public site shell (navbar + footer). Used from the root layout for non-admin routes.
 * Navbar is imported statically — `next/dynamic` here caused intermittent Webpack
 * `__webpack_modules__[moduleId] is not a function` with dev Fast Refresh on Windows.
 */
export function ConditionalChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Navbar />
      <main id="main-content" className="main-wrap" tabIndex={-1}>
        {children}
      </main>
      <Footer />
    </>
  );
}
