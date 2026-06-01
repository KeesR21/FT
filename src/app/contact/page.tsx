import Link from "next/link";
import { PublicRegistrationLink } from "@/components/public/public-registration-link";
import { buildPageMetadata } from "@/lib/cms-seo";
import { pageHeroFromSeo } from "@/lib/cms-seo";
import { getCachedSiteContent } from "@/lib/get-site-content-cached";
import type { Metadata } from "next";
import ContactForm from "./contact-form";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const c = await getCachedSiteContent();
  return buildPageMetadata(c, "contact", {
    title: "Contact",
    description: "Reach FTPR Lions Academy for registration, programs, schedules, and general enquiries."
  });
}

export default async function ContactPage() {
  const c = await getCachedSiteContent();
  const heroSrc = pageHeroFromSeo(c, "contact", c.contactHeroImage?.trim() || "/gallery/FTPR_25.JPG");
  const primaryEmail = c.contactInfo?.emails[0]?.address;
  const primaryPhone = c.contactInfo?.phones[0]?.number;

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
              Pitch locations
            </Link>
            <PublicRegistrationLink className="btn">Register</PublicRegistrationLink>
          </div>
        </div>
      </section>

      <div className="container page-y">
        <section className="contact-page-layout">
          <article className="card schedule-timeline-head contact-page-intro">
            <h2 className="page-section-title">How to reach us</h2>
            <p className="muted schedule-timeline-head__lead">
              Contact details and a quick form — we&apos;ll get back to you as soon as we can.
            </p>
          </article>

          <article className="card events-page-card contact-page-card" style={{ animationDelay: "0s" }}>
            <div className="events-page-card__body">
              <p className="events-page-card__meta">Contact</p>
              <h3 className="events-page-card__title">Information</h3>
              <p className="events-page-card__summary" style={{ whiteSpace: "pre-wrap" }}>
                {c.contactBlurb}
              </p>
              {primaryEmail ? (
                <p className="muted">
                  <a href={`mailto:${primaryEmail}`}>{primaryEmail}</a>
                </p>
              ) : null}
              {primaryPhone ? (
                <p className="muted">
                  <a href={`tel:${primaryPhone.replace(/\s/g, "")}`}>{primaryPhone}</a>
                </p>
              ) : null}
            </div>
          </article>

          <article className="card events-page-card contact-page-card" style={{ animationDelay: "0.05s" }}>
            <div className="events-page-card__body">
              <p className="events-page-card__meta">Message</p>
              <h3 className="events-page-card__title">Quick contact form</h3>
              <p className="contact-form__intro muted">
                Send a note — we&apos;ll reply as soon as we can.
              </p>
              <ContactForm />
            </div>
          </article>
        </section>
      </div>
    </>
  );
}
