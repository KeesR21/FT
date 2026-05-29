import Image from "next/image";
import Link from "next/link";
import { ProgramsDevelopmentPath } from "@/components/programs-development-path";
import { PublicRegistrationLink } from "@/components/public/public-registration-link";
import { getCachedSiteContent } from "@/lib/get-site-content-cached";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Programs",
  description:
    "Explore FTPR Lions Academy training programs — from youth development pathways to competitive teams, structured for every level."
};

export default async function ProgramsPage() {
  const c = await getCachedSiteContent();
  const heroSrc = c.programsHeroImage?.trim() || "/gallery/FTPR_18.JPG";
  const spotlight = c.programsSpotlightItems;
  const mosaicClass =
    spotlight.length <= 1 ? "programs-spotlight__mosaic--single" : "programs-spotlight__mosaic--split";

  return (
    <>
      <section className="programs-landing-hero ks-full-bleed programs-landing-hero--modern" aria-label="Programs hero">
        <div className="programs-landing-hero__mesh" aria-hidden />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={heroSrc}
          alt=""
          className="programs-landing-hero__bg programs-landing-hero__bg--motion"
          decoding="async"
        />
        <div className="programs-landing-hero__overlay programs-landing-hero__overlay--modern" aria-hidden />
        <div className="programs-landing-hero__orb programs-landing-hero__orb--a" aria-hidden />
        <div className="programs-landing-hero__orb programs-landing-hero__orb--b" aria-hidden />
        <div className="programs-landing-hero__inner container programs-landing-hero__inner--modern">
          <div className="programs-landing-hero__content">
            <span className="programs-landing-hero__eyebrow programs-hero-in">{c.programsPagePill}</span>
            <h1 className="programs-landing-hero__title programs-hero-in programs-hero-in--2">{c.programsPageTitle}</h1>
            <p className="programs-landing-hero__lead programs-hero-in programs-hero-in--3">{c.programsPageLead}</p>
            <div className="programs-landing-hero__actions programs-hero-in programs-hero-in--4">
              <PublicRegistrationLink className="btn programs-landing-hero__btn-primary">
                Register for trials
              </PublicRegistrationLink>
              <Link href="/schedule" className="btn btn-secondary programs-landing-hero__btn-ghost">
                View schedule
              </Link>
            </div>
          </div>
        </div>
        <div className="programs-landing-hero__scroller" aria-hidden>
          <span className="programs-landing-hero__scroller-line" />
          <span className="programs-landing-hero__scroller-text">Explore squads</span>
        </div>
      </section>

      <div className="container page-y programs-page-body">
        <div className="page-stack programs-landing-stack">
          {spotlight.length > 0 ? (
            <section className="programs-spotlight programs-spotlight--modern" aria-labelledby="programs-spotlight-heading">
              <div className="programs-spotlight__intro programs-slide-up">
                <h2 id="programs-spotlight-heading" className="programs-spotlight__title">
                  {c.programsSpotlightTitle}
                </h2>
                <p className="muted programs-spotlight__lead">{c.programsSpotlightLead}</p>
              </div>
              <div className={`programs-spotlight__mosaic ${mosaicClass}`}>
                <article
                  className="programs-spotlight-tile programs-spotlight-tile--feat programs-pop"
                  style={{ animationDelay: "0.05s" }}
                >
                  <div className="programs-spotlight-tile__frame">
                    <div className="programs-spotlight-tile__img-wrap">
                      <Image
                        src={spotlight[0].src}
                        alt={spotlight[0].caption}
                        width={800}
                        height={560}
                        className="programs-spotlight-tile__img"
                        unoptimized={spotlight[0].src.startsWith("/uploads/")}
                      />
                      <div className="programs-spotlight-tile__gradient" aria-hidden />
                    </div>
                    <p className="programs-spotlight-tile__caption">{spotlight[0].caption}</p>
                  </div>
                </article>
                {spotlight.length > 1 ? (
                  <div className="programs-spotlight__stack">
                    {spotlight.slice(1).map((item, index) => (
                      <article
                        key={item.id}
                        className="programs-spotlight-tile programs-spotlight-tile--compact programs-pop"
                        style={{ animationDelay: `${0.12 + index * 0.1}s` }}
                      >
                        <div className="programs-spotlight-tile__frame">
                          <div className="programs-spotlight-tile__img-wrap programs-spotlight-tile__img-wrap--compact">
                            <Image
                              src={item.src}
                              alt={item.caption}
                              width={480}
                              height={320}
                              className="programs-spotlight-tile__img"
                              unoptimized={item.src.startsWith("/uploads/")}
                            />
                            <div className="programs-spotlight-tile__gradient" aria-hidden />
                          </div>
                          <p className="programs-spotlight-tile__caption">{item.caption}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="programs-pathway programs-pathway--modern" aria-labelledby="programs-pathway-heading">
            <header className="programs-pathway__head programs-slide-up">
              <div className="programs-pathway__head-accent" aria-hidden />
              <div className="programs-pathway__head-text">
                <h2 id="programs-pathway-heading" className="programs-pathway__title">
                  {c.programsPathwayTitle}
                </h2>
                <p className="programs-pathway__blurb muted">{c.programsPathwayBlurb}</p>
              </div>
            </header>
            {c.programsPathwayLineItems.length >= 2 ? (
              <ProgramsDevelopmentPath
                title={c.programsPathwayLineTitle}
                lead={c.programsPathwayLineLead}
                scrollLabel={c.programsPathwayLineScrollLabel}
                items={c.programsPathwayLineItems}
              />
            ) : null}
          </section>

          <section className="programs-showcase" aria-label="Programs highlight">
            <div className="programs-showcase__grid">
              <article className="programs-showcase__copy card programs-slide-up programs-slide-up--delay">
                <span className="programs-showcase__label">Why it works</span>
                <h2 className="page-section-title programs-showcase__title">{c.programsSplitTitle}</h2>
                <p className="muted programs-showcase__lead">{c.programsSplitLead}</p>
                <div className="card-cta-row">
                  <Link href="/contact" className="btn btn-secondary">
                    Ask a question
                  </Link>
                  <PublicRegistrationLink className="btn">Start registration</PublicRegistrationLink>
                </div>
              </article>
              <div className="programs-showcase__visual programs-pop" style={{ animationDelay: "0.15s" }}>
                <div className="programs-showcase__tilt">
                  <Image
                    src={c.programsSideImage}
                    alt="FTPR Lions programs"
                    width={1200}
                    height={900}
                    className="programs-showcase__img"
                    unoptimized={c.programsSideImage.startsWith("/uploads/")}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="programs-landing-cta programs-landing-cta--modern programs-cta-glow" aria-label="Programs call to action">
            <div className="programs-landing-cta__inner">
              <h2 className="programs-landing-cta__title">{c.programsCtaTitle}</h2>
              <p className="programs-landing-cta__lead muted">{c.programsCtaLead}</p>
              <div className="programs-landing-cta__actions">
                <PublicRegistrationLink className="btn">Register now</PublicRegistrationLink>
                <Link href="/contact" className="btn btn-secondary">
                  Contact
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
