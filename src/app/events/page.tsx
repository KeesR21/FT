import Image from "next/image";
import Link from "next/link";
import { PublicRegistrationLink } from "@/components/public/public-registration-link";
import { format, isValid, parseISO } from "date-fns";
import { getCachedSiteContent } from "@/lib/get-site-content-cached";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Events",
  description: "Open days, training camps, and special fixtures at FTPR Lions Academy."
};

function formatRange(startsAt: string, endsAt?: string) {
  try {
    const a = parseISO(startsAt);
    if (!isValid(a)) return startsAt;
    if (endsAt) {
      const b = parseISO(endsAt);
      if (isValid(b)) return `${format(a, "EEE d MMM yyyy, HH:mm")} – ${format(b, "HH:mm")}`;
    }
    return format(a, "EEE d MMM yyyy, HH:mm");
  } catch {
    return startsAt;
  }
}

function isUpcoming(startsAt: string): boolean {
  try {
    return parseISO(startsAt) >= new Date();
  } catch {
    return true;
  }
}

const DEFAULT_EVENTS_HERO = "/gallery/FTPR_58.JPG";

export default async function EventsPage() {
  const c = await getCachedSiteContent();
  const published = c.events.filter((ev) => (ev.status ?? "published") === "published");
  const sorted = [...published].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const upcoming = sorted.filter((ev) => isUpcoming(ev.startsAt));
  const past = sorted.filter((ev) => !isUpcoming(ev.startsAt));

  return (
    <>
      <section className="schedule-landing-hero ks-full-bleed" aria-label="Events hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={DEFAULT_EVENTS_HERO} alt="" className="schedule-landing-hero__bg" decoding="async" />
        <div className="schedule-landing-hero__overlay" aria-hidden />
        <div className="schedule-landing-hero__inner container">
          <span className="schedule-landing-hero__pill">Academy events</span>
          <h1 className="schedule-landing-hero__title">{c.eventsPageTitle}</h1>
          <p className="schedule-landing-hero__lead">{c.eventsPageLead}</p>
          <div className="schedule-landing-hero__actions">
            <Link href="/contact" className="btn btn-secondary">Ask a question</Link>
            <PublicRegistrationLink className="btn">Register</PublicRegistrationLink>
          </div>
        </div>
      </section>

      <div className="container page-y">
        <section className="page-stack schedule-landing-stack">

          {sorted.length === 0 ? (
            <div className="events-empty card">
              <span className="events-empty__icon" aria-hidden>📅</span>
              <h2 className="events-empty__title">No events scheduled yet</h2>
              <p className="muted events-empty__lead">
                Check back soon — open days, camps, and fixtures will be listed here.
              </p>
              <Link href="/contact" className="btn btn-secondary">Get notified</Link>
            </div>
          ) : (
            <>
              {/* ── Upcoming events ──────────────────────────────── */}
              {upcoming.length > 0 && (
                <div>
                  <h2 className="events-section-title">
                    <span className="events-section-title__dot events-section-title__dot--live" aria-hidden />
                    Upcoming events
                  </h2>
                  <div className="events-page-grid">
                    {upcoming.map((ev, index) => (
                      <article
                        key={ev.id}
                        className="card events-page-card events-page-card--upcoming"
                        style={{ animationDelay: `${Math.min(index, 8) * 0.05}s` }}
                      >
                        <div className="events-page-card__media">
                          {ev.image ? (
                            <Image
                              src={ev.image}
                              alt={ev.title}
                              width={960}
                              height={600}
                              className="events-page-card__img"
                              sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 33vw"
                              unoptimized={ev.image.startsWith("/uploads/")}
                            />
                          ) : (
                            <div className="events-page-card__placeholder" aria-hidden />
                          )}
                          <span className="events-page-card__upcoming-badge">Upcoming</span>
                        </div>
                        <div className="events-page-card__body">
                          <p className="events-page-card__meta">{formatRange(ev.startsAt, ev.endsAt)}</p>
                          {ev.location && (
                            <p className="events-page-card__location">
                              <span className="events-page-card__location-icon" aria-hidden>◎</span>
                              {ev.location}
                            </p>
                          )}
                          <h3 className="events-page-card__title">{ev.title}</h3>
                          <p className="events-page-card__summary">{ev.summary}</p>
                          <div className="events-page-card__cta">
                            <Link href="/contact" className="btn btn-secondary events-page-card__cta-btn">
                              Register interest
                            </Link>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Past events ───────────────────────────────────── */}
              {past.length > 0 && (
                <div>
                  <h2 className="events-section-title events-section-title--past">
                    Past events
                  </h2>
                  <div className="events-page-grid events-page-grid--past">
                    {[...past].reverse().map((ev, index) => (
                      <article
                        key={ev.id}
                        className="card events-page-card events-page-card--past"
                        style={{ animationDelay: `${Math.min(index, 8) * 0.05}s` }}
                      >
                        <div className="events-page-card__media">
                          {ev.image ? (
                            <Image
                              src={ev.image}
                              alt={ev.title}
                              width={960}
                              height={600}
                              className="events-page-card__img"
                              sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 33vw"
                              unoptimized={ev.image.startsWith("/uploads/")}
                            />
                          ) : (
                            <div className="events-page-card__placeholder" aria-hidden />
                          )}
                        </div>
                        <div className="events-page-card__body">
                          <p className="events-page-card__meta">{formatRange(ev.startsAt, ev.endsAt)}</p>
                          {ev.location && (
                            <p className="events-page-card__location">
                              <span className="events-page-card__location-icon" aria-hidden>◎</span>
                              {ev.location}
                            </p>
                          )}
                          <h3 className="events-page-card__title">{ev.title}</h3>
                          <p className="events-page-card__summary">{ev.summary}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}
