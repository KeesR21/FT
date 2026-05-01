import Link from "next/link";
import { WeeklyCalendar } from "@/components/WeeklyCalendar";
import { db } from "@/lib/db";
import { getCachedSiteContent } from "@/lib/get-site-content-cached";
import { WEEKDAY_ORDER, sessionsToWeekSchedule } from "@/lib/weekly-schedule";

export const dynamic = "force-dynamic";

export default async function FixturesPage() {
  const content = await getCachedSiteContent();
  const sessions = [...(await db.listSessions())].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const { scheduleByDay, weekRangeLabel, defaultSelectedDay } = sessionsToWeekSchedule(sessions);
  const weekSessionCount = WEEKDAY_ORDER.reduce((n, d) => n + scheduleByDay[d].length, 0);
  const heroSrc = content.scheduleHeroImage?.trim() || "/gallery/FTPR_58.JPG";
  const locationSrc = content.scheduleLocationImage?.trim() || "/gallery/FTPR_49.JPG";

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
            <Link href="/register" className="btn">
              Register your child
            </Link>
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

          {sessions.length === 0 ? (
            <p className="muted card">No sessions published yet. Check back soon.</p>
          ) : (
            <article className="card schedule-weekly-calendar" aria-label="Weekly schedule">
              {weekSessionCount === 0 ? (
                <p className="muted schedule-weekly-calendar__empty-note">
                  No sessions fall in this calendar week (Mon–Sun). Dates are grouped by the week containing today.
                </p>
              ) : null}
              <WeeklyCalendar
                scheduleByDay={scheduleByDay}
                weekRangeLabel={weekRangeLabel}
                defaultSelectedDay={defaultSelectedDay}
              />
            </article>
          )}

          <section className="schedule-location card" aria-label="Pitch location">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={locationSrc} alt="" className="schedule-location__bg" decoding="async" />
            <div className="schedule-location__overlay" aria-hidden />
            <div className="schedule-location__inner">
              <h2 className="page-section-title schedule-location__title">{content.scheduleLocationTitle}</h2>
              <p className="schedule-location__lead">{content.scheduleLocationLead}</p>
            </div>
          </section>

          <div className="card schedule-parent-note">
            <h2 className="page-section-title">Parent notifications</h2>
            <p className="muted schedule-parent-note__lead">{content.scheduleParentBlurb}</p>
            <div className="card-cta-row">
              <Link href="/register" className="btn">
                Register your child
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
