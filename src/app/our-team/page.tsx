import Image from "next/image";
import Link from "next/link";
import { PublicRegistrationLink } from "@/components/public/public-registration-link";
import { getCachedSiteContent } from "@/lib/get-site-content-cached";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Our Team",
  description:
    "Meet the coaches and staff behind FTPR Lions Football Academy — dedicated professionals building the next generation of Rwandan footballers."
};

export default async function OurTeamPage() {
  const c = await getCachedSiteContent();

  return (
    <>
      {/* Full-bleed hero — consistent with About, Events, Contact */}
      <section className="schedule-landing-hero ks-full-bleed" aria-label="Our team hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/gallery/FTPR_49.JPG" alt="" className="schedule-landing-hero__bg" decoding="async" />
        <div className="schedule-landing-hero__overlay" aria-hidden />
        <div className="schedule-landing-hero__inner container">
          <span className="schedule-landing-hero__pill">Our team</span>
          <h1 className="schedule-landing-hero__title">{c.ourTeamPageTitle}</h1>
          <p className="schedule-landing-hero__lead">{c.ourTeamPageLead}</p>
          <div className="schedule-landing-hero__actions">
            <Link href="/contact" className="btn btn-secondary">Get in touch</Link>
            <PublicRegistrationLink className="btn">Join the academy</PublicRegistrationLink>
          </div>
        </div>
      </section>

      <div className="container page-y">
        <section className="page-stack">
          {c.teamMembers.length === 0 ? (
            <div className="our-team-empty card">
              <span className="our-team-empty__icon" aria-hidden>👥</span>
              <h2 className="our-team-empty__title">Coaching staff coming soon</h2>
              <p className="muted our-team-empty__lead">
                Our coach and staff profiles will be published here shortly.
              </p>
              <Link href="/contact" className="btn btn-secondary">Contact us</Link>
            </div>
          ) : (
            <div className="our-team-grid">
              {c.teamMembers.map((member) => (
                <article key={member.id} className="our-team-card card">
                  <div className="our-team-card__photo-wrap">
                    <Image
                      src={member.image}
                      alt={member.name}
                      width={800}
                      height={800}
                      className="our-team-card__photo"
                      unoptimized={member.image.startsWith("/uploads/")}
                    />
                  </div>
                  <div className="our-team-card__body">
                    <span className="our-team-card__role">{member.role}</span>
                    <h3 className="our-team-card__name">{member.name}</h3>
                    {member.description ? (
                      <p className="our-team-card__bio muted">{member.description}</p>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
