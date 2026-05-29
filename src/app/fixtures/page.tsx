import Link from "next/link";
import { PublicRegistrationLink } from "@/components/public/public-registration-link";
import { WeeklyScheduleView } from "@/components/schedule/WeeklyScheduleView";
import { getCachedSiteContent } from "@/lib/get-site-content-cached";
import { weeklySchedule } from "@/lib/weekly-schedule/server";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Schedule",
  description: "View the FTPR Lions weekly training schedule — sessions, times, age groups, and locations."
};

export default async function FixturesPage() {
  const content = await getCachedSiteContent();
  const publishedWeeks = weeklySchedule.listPublishedWeekStarts();
  const defaultWeek = publishedWeeks[publishedWeeks.length - 1];
  const heroSrc = content.scheduleHeroImage?.trim() || "/gallery/FTPR_58.JPG";

  return (
    <>
      <section className="schedule-landing-hero ks-full-bleed" aria-label="Schedule hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={heroSrc} alt="" className="schedule-landing-hero__bg" decoding="async" />
        <div className="schedule-landing-hero__overlay" aria-hidden />
        <div className="schedule-landing-hero__inner container">
          <span className="schedule-landing-hero__pill">{content.schedulePagePill}</span>
          <h1 className="schedule-landing-hero__title">{content.schedulePageTitle}</h1>
          <p className="schedule-landing-hero__lead">{content.schedulePageLead}</p>
          <div className="schedule-landing-hero__actions">
            <PublicRegistrationLink className="btn">Register your child</PublicRegistrationLink>
            <Link href="/contact" className="btn btn-secondary">
              Ask about schedules
            </Link>
          </div>
        </div>
      </section>

      <div className="container page-y">
        <section className="page-stack schedule-landing-stack">
          <article className="card schedule-timeline-head">
            <h2 className="page-section-title">{content.scheduleTimelineTitle}</h2>
            <p className="muted schedule-timeline-head__lead">{content.scheduleTimelineLead}</p>
          </article>

          <article className="card schedule-calendar-card" aria-label="Weekly training schedule">
            <p className="muted schedule-calendar-card__hint">
              Published weekly timetable (Monday–Sunday). Tap a session for full details. Only the latest active version is shown.
            </p>
            {publishedWeeks.length === 0 ? (
              <p className="muted">No published weekly schedule yet. Check back soon.</p>
            ) : (
              <WeeklyScheduleView initialWeekStart={defaultWeek} />
            )}
          </article>
        </section>
      </div>
    </>
  );
}
