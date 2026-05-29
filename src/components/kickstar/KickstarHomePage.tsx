import Image from "next/image";
import Link from "next/link";
import { KickstarAccordion } from "@/components/kickstar/Accordion";
import { KickstarBlogPostsGrid } from "@/components/kickstar/BlogPostsGrid";
import { formatNewsListDate } from "@/lib/news-dates";
import { excerptFromNewsHtml } from "@/lib/news-html";
import { KickstarCounterRow } from "@/components/kickstar/CounterRow";
import { EliteInspiredQuoteSlider } from "@/components/kickstar/EliteInspiredQuoteSlider";
import { KickstarElementsKitHeading } from "@/components/kickstar/ElementsKitHeading";
import { HomeTodayScheduleCardWithRefresh } from "@/components/kickstar/HomeTodayScheduleCardWithRefresh";
import { KickstarGlassCard } from "@/components/kickstar/GlassCard";
import { KickstarIconBox } from "@/components/kickstar/IconBox";
import { KickstarIconList } from "@/components/kickstar/IconList";
import { KickstarJKitButton } from "@/components/kickstar/JKitButton";
import { KickstarProgressBar } from "@/components/kickstar/ProgressBar";
import { KickstarRichText } from "@/components/kickstar/RichText";
import { KickstarSpacer } from "@/components/kickstar/Spacer";
import { KickstarTestimonial } from "@/components/kickstar/Testimonial";
import { KitPeriodBanner } from "@/components/public/kit-period-banner";
import { PUBLIC_REGISTRATION_ENABLED, filterPublicRegistrationFaqItems } from "@/lib/site-features";
import type { CounterItem } from "@/components/kickstar/types";
import type { HomeScheduleBrief } from "@/lib/weekly-schedule/home-today-brief";
import type { CmsFaqItem, CmsHomeCounter, CmsHomeHeroImages, CmsHomeSectionImages, CmsHomeTestimonial, CmsNewsPost } from "@/lib/types";

export type KickstarHomePageProps = {
  welcomePill?: string;
  heroHeading?: string;
  /** Shown in the “Shaping Tomorrow…” rich text block (from CMS academy info). */
  academySummary?: string;
  /** Hero background under public/ (native img — avoids optimizer issues on large JPEGs). */
  heroBackgroundSrc?: string;
  /** CMS “highlights” row below counters. */
  homeHighlights?: { id: string; title: string; body: string }[];
  /** Up to three news cards — from CMS `newsPosts` (home “News & updates” strip). */
  newsPreview?: CmsNewsPost[];
  homeCounters?: CmsHomeCounter[];
  homeHeroImages?: CmsHomeHeroImages;
  homeSectionImages?: CmsHomeSectionImages;
  todayScheduleBrief: HomeScheduleBrief;
  homeEliteTitle?: string;
  homeEliteBody?: string;
  homeMatchTitle?: string;
  homeMatchDescription?: string;
  homeTimetableTitle?: string;
  homeTimetableDescription?: string;
  homeDevelopmentLabel?: string;
  homeDevelopmentPercent?: number;
  homeParentSatisfactionLabel?: string;
  homeParentSatisfactionPercent?: number;
  homeTestimonial?: CmsHomeTestimonial;
  homeFaqItems?: CmsFaqItem[];
  homePathTitle?: string;
  homePathLead?: string;
  homePathTeams?: string[];
  homeTrainingTitle?: string;
  homeTrainingLead?: string;
  homeJoinTitle?: string;
  homeJoinLead?: string;
  homeJoinButtonLabel?: string;
};

/** Hero background — gallery image */
const HOME_HERO_VISUAL = "/gallery/FTPR_49.JPG";

const DEFAULT_WELCOME = "Welcome to FTPR Lions";
const DEFAULT_HERO = "THE JOURNEY TO GREATNESS STARTS HERE";
const DEFAULT_ACADEMY_SUMMARY =
  "We combine professional coaching, discipline, and player welfare to develop confident footballers on and off the pitch. Progress is tracked transparently for parents and staff.";

const COUNTERS: CmsHomeCounter[] = [
  { id: "hc-default-1", end: 10, suffix: "k+", title: "Players Trained", numberVariant: "accent" },
  { id: "hc-default-2", end: 200, suffix: "+", title: "Tournaments Won", numberVariant: "default" },
  { id: "hc-default-3", end: 500, suffix: "+", title: "Matches Played", numberVariant: "accent" },
  { id: "hc-default-4", end: 350, suffix: "+", title: "Contracts Signed", numberVariant: "default" }
];
const DEFAULT_FAQ: CmsFaqItem[] = [
  {
    id: "1",
    title: "How do I register my child?",
    content: "Use the Registration page, complete the form, and wait for admin approval. You will receive an email when the status changes."
  },
  {
    id: "2",
    title: "How are fees paid?",
    content: "Fees are tracked in RWF. Mobile money payments can be submitted and verified manually by the academy admin."
  },
  {
    id: "3",
    title: "How do I get schedule reminders?",
    content: "When automated notifications are enabled, reminders are sent by group for training and matches."
  }
];

export function KickstarHomePage({
  welcomePill = DEFAULT_WELCOME,
  heroHeading = DEFAULT_HERO,
  academySummary = DEFAULT_ACADEMY_SUMMARY,
  heroBackgroundSrc,
  homeHighlights,
  newsPreview = [],
  homeCounters = COUNTERS,
  homeHeroImages = { logo: "/logo.jpeg" },
  homeSectionImages = { pathway: "/academy-3.png", training: "/academy-2.png", iconLogo: "/logo.jpeg" },
  homeMatchTitle = "Match performance",
  homeMatchDescription = "Weekly fixtures and competitive exposure by age group.",
  homeTimetableTitle = "Structured timetable",
  homeTimetableDescription = "Training blocks published online and sent by email reminders.",
  homeDevelopmentLabel = "Player development pathway",
  homeDevelopmentPercent = 85,
  homeParentSatisfactionLabel = "Parent satisfaction (internal)",
  homeParentSatisfactionPercent = 92,
  homeTestimonial = {
    eyebrow: "Parent voice",
    quote:
      "Our coaches are consistent and easy to reach—my son looks forward to every session. Fees and the weekly schedule are clear, so we always know what’s next.",
    name: "Parent, FTPR Lions family",
    role: "U14 squad",
    imageSrc: "/academy-2.png",
    imageAlt: "FTPR Lions parent"
  },
  homeFaqItems = DEFAULT_FAQ,
  homePathTitle = "Your Path to Football {{Excellence}}",
  homePathLead = "Age-specific programs from foundation skills to elite preparation.",
  homePathTeams = ["U7", "U9", "U11", "U14A", "U14B", "U16", "U18", "Elite Camp"],
  homeTrainingTitle = "Training & {{Schedule}}",
  homeTrainingLead = "Tuesday and Thursday blocks, Saturday matchdays.",
  homeJoinTitle = "Join FTPR Lions {{Today}}",
  homeJoinLead = "Start registration — our team will review your application.",
  homeJoinButtonLabel = "Start registration",
  todayScheduleBrief
}: KickstarHomePageProps) {
  const heroBg = heroBackgroundSrc?.trim() || HOME_HERO_VISUAL;
  const blogCards = newsPreview.slice(0, 3).map((p) => ({
    id: p.id,
    title: p.title,
    excerpt: excerptFromNewsHtml(p.content),
    href: `/news/${encodeURIComponent(p.id)}`,
    image: p.image,
    date: formatNewsListDate(p.publishedAt, p.date),
    publishedAt: p.publishedAt
  }));
  const countersForUi: CounterItem[] = homeCounters.map((c) => ({
    end: c.end,
    suffix: c.suffix,
    title: c.title,
    numberVariant: c.numberVariant
  }));
  const faqItems = filterPublicRegistrationFaqItems(homeFaqItems);
  return (
    <>
      <KitPeriodBanner />
      {/* Section: hero — icon-list, elementskit-heading, glass row, jkit + video */}
      <div className="ks-full-bleed ks-hero-root">
        {/* Native <img> avoids /_next/image + sharp (common source of HTTP 500 on large JPEGs). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={heroBg}
          alt="FTPR Lions academy football"
          className="ks-hero-bg-native"
          decoding="async"
        />
        <div className="ks-hero-overlay" aria-hidden />
        <div className="ks-hero-stage">
          <div className="ks-hero-copy">
            <KickstarIconList text={welcomePill} />
            <KickstarElementsKitHeading as="h1" align="center" title={heroHeading} />
            <div className="ks-hero-actions">
              <KickstarJKitButton href="/programs" label="Explore programs" iconAfter={<span aria-hidden>↗</span>} />
              {PUBLIC_REGISTRATION_ENABLED ? (
                <KickstarJKitButton href="/register" label="Register now" variant="secondary" />
              ) : null}
            </div>
          </div>

          <div className="ks-hero-triple">
            <HomeTodayScheduleCardWithRefresh brief={todayScheduleBrief} />

            <div className="ks-hero-player-wrap ks-hero-logo-wrap">
              <div className="ks-hero-logo-panel">
                <Image
                  src={homeHeroImages.logo}
                  alt="FTPR Lions"
                  width={168}
                  height={168}
                  className="ks-hero-ftpr-logo"
                  priority
                />
              </div>
            </div>

            <KickstarGlassCard className="ks-hero-glass--elite">
              <EliteInspiredQuoteSlider />
            </KickstarGlassCard>
          </div>
        </div>
      </div>

      {blogCards.length > 0 ? (
        <section className="container home-top-section" aria-label="News and updates">
          <KickstarElementsKitHeading as="h2" align="left" title="News & {{updates}}" />
          <KickstarSpacer height={16} />
          <KickstarBlogPostsGrid posts={blogCards} />
        </section>
      ) : null}

      {/* stats section */}
      <section className="container home-top-section" aria-label="Academy stats" style={{ marginTop: "1.5rem" }}>
        <div className="ks-counter-wrap">
          <KickstarCounterRow items={countersForUi} />
        </div>
      </section>

      {homeHighlights && homeHighlights.length > 0 ? (
        <section className="container home-top-section" aria-label="Academy highlights">
          <div className="k-three-col">
            {homeHighlights.map((h) => (
              <article className="card" key={h.id}>
                <h3 className="page-section-title">{h.title}</h3>
                <p className="muted" style={{ whiteSpace: "pre-wrap" }}>
                  {h.body}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className="container page-y">
        <section className="page-stack page-stack--xl">
          <div className="card">
            <KickstarElementsKitHeading
              as="h2"
              align="left"
              title={"Shaping Tomorrow\u2019s Football {{Stars, One Player at a Time}}"}
            />
            <KickstarSpacer height={16} />
            <KickstarRichText>{academySummary}</KickstarRichText>
            <KickstarSpacer height={20} />
            <KickstarJKitButton href="/about" label="Learn more" />
          </div>

          <div className="k-two-col">
            <article className="card">
              <KickstarIconBox
                icon={
                  <Image
                    src={homeSectionImages.iconLogo}
                    alt=""
                    width={32}
                    height={32}
                    className="ks-ftpr-logo ks-ftpr-logo--box"
                  />
                }
                title={homeMatchTitle}
                description={homeMatchDescription}
              />
              <KickstarSpacer height={20} />
              <KickstarIconBox
                icon={<span className="ks-icon-emoji">📅</span>}
                title={homeTimetableTitle}
                description={homeTimetableDescription}
              />
            </article>
            <article className="card">
              <KickstarProgressBar percent={homeDevelopmentPercent} label={homeDevelopmentLabel} />
              <KickstarSpacer height={20} />
              <KickstarProgressBar percent={homeParentSatisfactionPercent} label={homeParentSatisfactionLabel} />
            </article>
          </div>

          <div className="card ks-parent-voice">
            <KickstarTestimonial
              eyebrow={homeTestimonial.eyebrow}
              quote={homeTestimonial.quote}
              name={homeTestimonial.name}
              role={homeTestimonial.role}
              imageSrc={homeTestimonial.imageSrc}
              imageAlt={homeTestimonial.imageAlt}
            />
          </div>

          <div className="card">
            <KickstarElementsKitHeading as="h2" align="left" title="Frequently asked {{questions}}" />
            <KickstarSpacer height={16} />
            <KickstarAccordion
              items={faqItems}
            />
          </div>

          <section className="k-two-col k-section">
            <article className="card">
              <KickstarElementsKitHeading as="h2" align="left" title={homePathTitle} />
              <KickstarRichText>{homePathLead}</KickstarRichText>
              <div className="k-four-col card-cta-row">
                {homePathTeams.map((team) => (
                  <div className="program-tile" key={team}>
                    <h3>{team}</h3>
                    <p>Weekly training</p>
                  </div>
                ))}
              </div>
              <KickstarSpacer height={16} />
              <KickstarJKitButton href="/programs" label="View programs" />
            </article>
            <article className="card">
              <Image
                src={homeSectionImages.pathway}
                alt="Your path to football excellence"
                width={1200}
                height={900}
                className="k-img k-img--contain"
                unoptimized={homeSectionImages.pathway.startsWith("/uploads/")}
              />
            </article>
          </section>

          <section className="k-two-col k-section">
            <article className="card">
              <KickstarElementsKitHeading as="h2" align="left" title={homeTrainingTitle} />
              <KickstarRichText>{homeTrainingLead}</KickstarRichText>
              <KickstarJKitButton href="/schedule" label="Full schedule" />
            </article>
            <article className="card">
              <Image src={homeSectionImages.training} alt="Team" width={1200} height={900} className="k-img" />
            </article>
          </section>

          {PUBLIC_REGISTRATION_ENABLED ? (
            <section className="card k-center">
              <KickstarElementsKitHeading as="h2" align="center" title={homeJoinTitle} />
              <KickstarRichText>{homeJoinLead}</KickstarRichText>
              <KickstarJKitButton href="/register" label={homeJoinButtonLabel} />
            </section>
          ) : null}
        </section>
      </div>
    </>
  );
}
