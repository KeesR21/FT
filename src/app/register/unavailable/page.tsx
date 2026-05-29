import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Registration",
  description: "Player registration is not open on the website at this time."
};

/** Shown when PUBLIC_REGISTRATION_ENABLED is false (register layout redirects here). */
export default function RegisterUnavailablePage() {
  return (
    <div className="container page-y">
      <article className="card" style={{ maxWidth: "36rem", margin: "0 auto", textAlign: "center" }}>
        <h1 className="page-section-title">Registration</h1>
        <p className="muted" style={{ margin: "0 0 1.25rem", lineHeight: 1.6 }}>
          Online player registration is not available on the website right now. For enquiries about joining the academy,
          please contact us directly.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", justifyContent: "center" }}>
          <Link href="/contact" className="btn">
            Contact us
          </Link>
          <Link href="/" className="btn btn-secondary">
            Back to home
          </Link>
        </div>
      </article>
    </div>
  );
}
