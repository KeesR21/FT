import Link from "next/link";
import { getCachedSiteContent } from "@/lib/get-site-content-cached";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contact",
  description: "Reach FTPR Lions Academy for registration, programs, schedules, and general enquiries."
};

const DEFAULT_CONTACT_HERO = "/gallery/FTPR_25.JPG";

export default async function ContactPage() {
  const c = await getCachedSiteContent();
  const heroSrc = DEFAULT_CONTACT_HERO;

  return (
    <>
      <section className="schedule-landing-hero ks-full-bleed" aria-label="Contact hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={heroSrc} alt="" className="schedule-landing-hero__bg" decoding="async" />
        <div className="schedule-landing-hero__overlay" aria-hidden />
        <div className="schedule-landing-hero__inner container">
          <span className="schedule-landing-hero__pill">Get in touch</span>
          <h1 className="schedule-landing-hero__title">Get in Touch with FTPR Lions</h1>
          <p className="schedule-landing-hero__lead">{c.contactPageLead}</p>
          <div className="schedule-landing-hero__actions">
            <Link href="/locations" className="btn btn-secondary">
              Our locations
            </Link>
            <Link href="/register" className="btn">
              Register
            </Link>
          </div>
        </div>
      </section>

      <div className="container page-y">
        <section className="contact-page-layout">
          <article className="card schedule-timeline-head contact-page-intro">
            <h2 className="page-section-title">How to reach us</h2>
            <p className="muted schedule-timeline-head__lead">
              Office details and a quick form — we reply during published hours.
            </p>
          </article>

          <article className="card events-page-card contact-page-card" style={{ animationDelay: "0s" }}>
            <div className="events-page-card__body">
              <p className="events-page-card__meta">Contact</p>
              <h3 className="events-page-card__title">Information</h3>
              <p className="events-page-card__summary" style={{ whiteSpace: "pre-wrap" }}>
                {c.contactBlurb}
              </p>
              <p className="contact-page-card__hours muted">{c.contactOfficeHours}</p>
            </div>
          </article>

          <article className="card events-page-card contact-page-card" style={{ animationDelay: "0.05s" }}>
            <div className="events-page-card__body">
              <p className="events-page-card__meta">Message</p>
              <h3 className="events-page-card__title">Quick contact form</h3>
              <p className="contact-form__intro muted">
                Send a note — we&apos;ll reply during office hours.
              </p>
              <form className="contact-form" noValidate>
                <div className="contact-form__panel">
                  <div className="contact-form__split">
                    <div className="contact-form__field">
                      <label htmlFor="contact-name" className="contact-form__label">
                        Full name
                      </label>
                      <input
                        id="contact-name"
                        name="name"
                        type="text"
                        autoComplete="name"
                        className="input-field contact-form__control"
                        placeholder="Jane Doe"
                      />
                    </div>
                    <div className="contact-form__field">
                      <label htmlFor="contact-email" className="contact-form__label">
                        Email
                      </label>
                      <input
                        id="contact-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        className="input-field contact-form__control"
                        placeholder="you@example.com"
                      />
                    </div>
                  </div>
                  <div className="contact-form__field">
                    <label htmlFor="contact-message" className="contact-form__label">
                      Your message
                    </label>
                    <textarea
                      id="contact-message"
                      name="message"
                      rows={4}
                      className="input-field contact-form__control"
                      placeholder="How can we help?"
                    />
                  </div>
                </div>
                <div className="contact-form__footer">
                  <button type="button" className="btn contact-form__submit">
                    <svg
                      className="contact-form__submit-icon"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden
                    >
                      <path
                        d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Send message
                  </button>
                </div>
              </form>
            </div>
          </article>
        </section>
      </div>
    </>
  );
}
