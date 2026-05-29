import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { getPublicNavLinks } from "@/lib/public-nav-links";

export const metadata: Metadata = {
  title: "Page not found",
  description: "The page you're looking for doesn't exist."
};

export default function NotFound() {
  return (
    <div className="not-found-page">
      <div className="not-found-page__inner">
        <div className="not-found-page__logo-wrap">
          <Image
            src="/logo.jpeg"
            alt="FTPR Lions logo"
            width={72}
            height={72}
            className="not-found-page__logo"
            priority
          />
        </div>

        <p className="not-found-page__code">404</p>
        <h1 className="not-found-page__heading">Page not found</h1>
        <p className="not-found-page__lead">
          The page you&apos;re looking for doesn&apos;t exist or has been moved. Head back home
          or explore the site below.
        </p>

        <div className="not-found-page__actions">
          <Link href="/" className="btn">
            Back to home
          </Link>
          <Link href="/contact" className="btn btn-secondary">
            Contact us
          </Link>
        </div>

        <nav className="not-found-page__links" aria-label="Quick links">
          {getPublicNavLinks()
            .filter(([href]) => href !== "/")
            .map(([href, label]) => (
              <Link key={href} href={href} className="not-found-page__link">
                {label}
              </Link>
            ))}
        </nav>
      </div>
    </div>
  );
}
