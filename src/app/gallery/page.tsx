import Image from "next/image";
import Link from "next/link";
import { PublicRegistrationLink } from "@/components/public/public-registration-link";
import { getCachedSiteContent } from "@/lib/get-site-content-cached";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gallery",
  description: "Photo albums from FTPR Lions Academy — training, matchday, and academy life."
};

const DEFAULT_GALLERY_HERO = "/gallery/FTPR_49.JPG";

export default async function GalleryPage() {
  const c = await getCachedSiteContent();
  const albums = c.galleryAlbums;
  const heroSrc = albums[0]?.coverSrc ?? DEFAULT_GALLERY_HERO;

  return (
    <>
      <section className="schedule-landing-hero ks-full-bleed" aria-label="Gallery hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={heroSrc} alt="" className="schedule-landing-hero__bg" decoding="async" />
        <div className="schedule-landing-hero__overlay" aria-hidden />
        <div className="schedule-landing-hero__inner container">
          <span className="schedule-landing-hero__pill">Academy photos</span>
          <h1 className="schedule-landing-hero__title">{c.galleryPageTitle}</h1>
          <p className="schedule-landing-hero__lead">{c.galleryPageLead}</p>
          <div className="schedule-landing-hero__actions">
            <Link href="/contact" className="btn btn-secondary">
              Ask a question
            </Link>
            <PublicRegistrationLink className="btn">Register</PublicRegistrationLink>
          </div>
        </div>
      </section>

      <div className="container page-y">
        <section className="page-stack schedule-landing-stack">
          <article className="card schedule-timeline-head">
            <h2 className="page-section-title">Albums</h2>
            <p className="muted schedule-timeline-head__lead">
              Browse by theme — open an album to view full sets of images.
            </p>
          </article>

          {albums.length === 0 ? (
            <p className="muted card gallery-page-empty">No albums yet.</p>
          ) : (
            <div className="events-page-grid">
              {albums.map((album, index) => {
                const href = `/gallery/${encodeURIComponent(album.id)}`;
                const filledImages = album.images.filter((im) => im.src?.trim());
                const coverSrc =
                  album.coverSrc?.trim() ||
                  filledImages[0]?.src ||
                  "/gallery/FTPR_49.JPG";
                const unopt = coverSrc.startsWith("/uploads/");
                const count = filledImages.length;
                const displayTitle = album.title?.trim() || "Untitled album";
                return (
                  <Link
                    key={album.id}
                    href={href}
                    className="card events-page-card gallery-album-card"
                    style={{ animationDelay: `${Math.min(index, 8) * 0.05}s` }}
                  >
                    <div className="events-page-card__media gallery-album-card__media">
                      <div className="gallery-album-card__visual" aria-hidden>
                        <span className="gallery-album-card__sheet gallery-album-card__sheet--3" />
                        <span className="gallery-album-card__sheet gallery-album-card__sheet--2" />
                        <div className="gallery-album-card__cover">
                          <Image
                            src={coverSrc}
                            alt=""
                            width={800}
                            height={500}
                            className="gallery-album-card__img"
                            sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 33vw"
                            unoptimized={unopt}
                          />
                          <div className="gallery-album-card__overlay" />
                          <span className="gallery-album-card__badge">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                              <path
                                d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Z"
                                stroke="currentColor"
                                strokeWidth="1.5"
                              />
                              <path
                                d="M8 10h8M8 14h5"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                              />
                              <circle cx="16" cy="8" r="2.5" fill="currentColor" opacity="0.35" />
                            </svg>
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="events-page-card__body">
                      <p className="events-page-card__meta">
                        {count} photo{count === 1 ? "" : "s"}
                      </p>
                      <h3 className="events-page-card__title">{displayTitle}</h3>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
