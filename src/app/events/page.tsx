import Image from "next/image";
import Link from "next/link";
import { format, isValid, parseISO } from "date-fns";
import { getCachedSiteContent } from "@/lib/get-site-content-cached";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Events",
  description: "Open days, camps, and special fixtures at FTPR Lions Academy."
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

const DEFAULT_EVENTS_HERO = "/gallery/FTPR_58.JPG";

export default async function EventsPage() {
  const c = await getCachedSiteContent();
  const sorted = [...c.events].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const heroSrc = DEFAULT_EVENTS_HERO;

  return (
    <>
      <section className="schedule-landing-hero ks-full-bleed" aria-label="Events hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={heroSrc} alt="" className="schedule-landing-hero__bg" decoding="async" />
        <div className="schedule-landing-hero__overlay" aria-hidden />
        <div className="schedule-landing-hero__inner container">
          <span className="schedule-landing-hero__pill">Academy events</span>
          <h1 className="schedule-landing-hero__title">{c.eventsPageTitle}</h1>
          <p className="schedule-landing-hero__lead">{c.eventsPageLead}</p>
          <div className="schedule-landing-hero__actions">
            <Link href="/contact" className="btn btn-secondary">
              Ask a question
            </Link>
            <Link href="/register" className="btn">
              Register
            </Link>
          </div>
        </div>
      </section>

      <div className="container page-y">
        <section className="page-stack schedule-landing-stack">
          <article className="card schedule-timeline-head">
            <h2 className="page-section-title">What&apos;s on</h2>
            <p className="muted schedule-timeline-head__lead">
              Open days, camps, and special fixtures — dates and details below.
            </p>
          </article>

          {sorted.length === 0 ? (
            <p className="muted card events-page-empty">No events published yet. Check back soon.</p>
          ) : (
            <div className="events-page-grid">
              {sorted.map((ev, index) => (
                <article
                  key={ev.id}
                  className="card events-page-card"
                  style={{ animationDelay: `${Math.min(index, 8) * 0.05}s` }}
                >
                  <div className="events-page-card__media">
                    {ev.image ? (
                      <Image
                        src={ev.image}
                        alt=""
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
                    {ev.location ? (
                      <p className="events-page-card__location">
                        <span className="events-page-card__location-icon" aria-hidden>
                          ◎
                        </span>
                        {ev.location}
                      </p>
                    ) : null}
                    <h3 className="events-page-card__title">{ev.title}</h3>
                    <p className="events-page-card__summary">{ev.summary}</p>
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
