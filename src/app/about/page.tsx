import Image from "next/image";
import Link from "next/link";
import { PublicRegistrationLink } from "@/components/public/public-registration-link";
import { getCachedSiteContent } from "@/lib/get-site-content-cached";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn about FTPR Lions Football Academy — our mission, coaching philosophy, and commitment to developing well-rounded footballers in Rwanda."
};

/** Split "Lead — detail" gallery captions into two lines when an em dash is present. */
function splitGalleryCaption(caption: string): { lead: string; detail: string | null } {
  const sep = " — ";
  const i = caption.indexOf(sep);
  if (i === -1) return { lead: caption, detail: null };
  return { lead: caption.slice(0, i).trim(), detail: caption.slice(i + sep.length).trim() || null };
}

export default async function AboutPage() {
  const c = await getCachedSiteContent();
  const heroSrc = c.aboutHeroImage?.trim() || "/gallery/FTPR_49.JPG";

  return (
    <>
      <section className="about-landing-hero ks-full-bleed" aria-label="About hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={heroSrc} alt="" className="about-landing-hero__bg" decoding="async" />
        <div className="about-landing-hero__overlay" aria-hidden />
        <div className="about-landing-hero__inner container">
          <span className="k-pill about-landing-hero__pill">{c.aboutPagePill}</span>
          <h1 className="about-landing-hero__title">{c.aboutPageTitle}</h1>
          <p className="about-landing-hero__lead">{c.aboutPageLead}</p>
          <div className="about-landing-hero__actions">
            <PublicRegistrationLink className="btn">Join the academy</PublicRegistrationLink>
            <Link href="/programs" className="btn btn-secondary">
              View programs
            </Link>
          </div>
        </div>
      </section>

      <div className="container page-y">
        <section className="page-stack about-landing-stack">
          <article className="card about-landing-vision">
            <h2 className="page-section-title">Mission</h2>
            <p className="about-landing-vision__text muted">{c.aboutMission}</p>
          </article>
          <article className="card about-landing-vision">
            <h2 className="page-section-title">{c.aboutVisionTitle}</h2>
            <p className="about-landing-vision__text muted">{c.aboutVision}</p>
          </article>
          {c.aboutHistory ? (
            <article className="card about-landing-vision">
              <h2 className="page-section-title">History</h2>
              <p className="about-landing-vision__text muted">{c.aboutHistory}</p>
            </article>
          ) : null}
          {c.aboutManagementMessage ? (
            <article className="card about-landing-vision">
              <h2 className="page-section-title">Message from management</h2>
              <p className="about-landing-vision__text muted">{c.aboutManagementMessage}</p>
            </article>
          ) : null}

          {c.aboutGalleryItems.length > 0 ? (
            <div className="about-landing-gallery" aria-label="Academy moments">
              {c.aboutGalleryItems.map((g, index) => {
                const { lead, detail } = splitGalleryCaption(g.caption);
                return (
                  <figure className="about-landing-gallery__item card about-landing-gallery__card" key={g.id}>
                    <div className="about-landing-gallery__img-wrap">
                      <Image
                        src={g.src}
                        alt={g.caption}
                        width={800}
                        height={520}
                        className="about-landing-gallery__img"
                        unoptimized={g.src.startsWith("/uploads/")}
                      />
                    </div>
                    <figcaption className="about-landing-gallery__caption">
                      <span className="about-landing-gallery__caption-index" aria-hidden="true">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="about-landing-gallery__caption-body">
                        <span className="about-landing-gallery__caption-lead">{lead}</span>
                        {detail ? (
                          <span className="about-landing-gallery__caption-detail">{detail}</span>
                        ) : null}
                      </span>
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          ) : null}

          <div>
            <h2 className="page-section-title about-landing-values-h">{c.aboutValuesTitle}</h2>
            {c.aboutTiles.length === 0 ? (
              <p className="muted card about-landing-values-empty">
                Our core values will be published here shortly.
              </p>
            ) : (
              <div className="about-landing-values">
                {c.aboutTiles.map((t) => (
                  <article className="card about-landing-value-card" key={t.id}>
                    <h3 className="about-landing-value-card__title">{t.title}</h3>
                    <p className="muted about-landing-value-card__body">{t.body}</p>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="about-landing-split k-two-col">
            <article className="card about-landing-split__copy">
              <h2 className="page-section-title">{c.aboutSplitTitle}</h2>
              <p className="muted about-landing-split__lead">{c.aboutSplitLead}</p>
              <div className="card-cta-row">
                <Link href="/our-team" className="btn btn-secondary">
                  Meet the team
                </Link>
                <Link href="/contact" className="btn">
                  Contact us
                </Link>
              </div>
            </article>
            <article className="card about-landing-split__visual">
              <Image
                src={c.aboutPageImage}
                alt="FTPR Lions academy"
                width={1200}
                height={900}
                className="k-img about-landing-side-img"
                unoptimized={c.aboutPageImage.startsWith("/uploads/")}
              />
            </article>
          </div>

          <section className="card about-landing-cta" aria-label="Call to action">
            <h2 className="page-section-title about-landing-cta__title">{c.aboutCtaTitle}</h2>
            <p className="about-landing-cta__lead muted">{c.aboutCtaLead}</p>
            <div className="about-landing-cta__actions">
              <PublicRegistrationLink className="btn">Register now</PublicRegistrationLink>
              <Link href="/schedule" className="btn btn-secondary">
                See schedule
              </Link>
            </div>
          </section>
        </section>
      </div>
    </>
  );
}
