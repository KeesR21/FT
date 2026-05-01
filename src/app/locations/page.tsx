import Link from "next/link";
import { LocationsExperience } from "@/components/locations/LocationsExperience";
import { getCachedSiteContent } from "@/lib/get-site-content-cached";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Locations",
  description: "Training sites and maps — FTPR Lions Academy pitch locations."
};

const DEFAULT_LOCATIONS_HERO = "/gallery/FTPR_58.JPG";

export default async function LocationsPage() {
  const c = await getCachedSiteContent();
  const pitches = c.pitchLocations;

  return (
    <>
      <section className="schedule-landing-hero ks-full-bleed" aria-label="Locations hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={DEFAULT_LOCATIONS_HERO} alt="" className="schedule-landing-hero__bg" decoding="async" />
        <div className="schedule-landing-hero__overlay" aria-hidden />
        <div className="schedule-landing-hero__inner container">
          <span className="schedule-landing-hero__pill">Training sites</span>
          <h1 className="schedule-landing-hero__title">{c.locationPageTitle}</h1>
          <p className="schedule-landing-hero__lead">{c.locationPageLead}</p>
          <div className="schedule-landing-hero__actions">
            <Link href="/contact" className="btn btn-secondary">
              Ask a question
            </Link>
            <Link href="/schedule" className="btn">
              Schedule
            </Link>
          </div>
        </div>
      </section>

      <div className="container page-y">
        <section className="locations-page-layout">
          <article className="card schedule-timeline-head locations-page-intro">
            <h2 className="page-section-title">Explore pitches</h2>
            <p className="muted schedule-timeline-head__lead">
              Select a pitch by name — details and the map update instantly without leaving the page.
            </p>
          </article>

          <LocationsExperience pitches={pitches} />
        </section>
      </div>
    </>
  );
}
