import { KickstarHomePage } from "@/components/kickstar/KickstarHomePage";
import { getCachedSiteContent } from "@/lib/get-site-content-cached";
import { sortNewsPostsByPublishedDesc } from "@/lib/news-posts";
import { getHomeScheduleBrief } from "@/lib/weekly-schedule/home-today-brief";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Home",
  description:
    "FTPR Lions Football Academy — professional youth development in Rwanda. Structured training, competitive fixtures, and full transparency for families."
};

export default async function HomePage() {
  const c = await getCachedSiteContent();
  return (
    <KickstarHomePage
      welcomePill={c.homeWelcomePill}
      heroHeading={c.homeHeroHeading}
      academySummary={c.academyInfo}
      heroBackgroundSrc={c.homeHeroImage}
      homeHighlights={c.homeHighlightItems}
      newsPreview={sortNewsPostsByPublishedDesc(c.newsPosts).slice(0, 3)}
      homeCounters={c.homeCounters}
      todayScheduleBrief={await getHomeScheduleBrief()}
      homeEliteTitle={c.homeEliteTitle}
      homeEliteBody={c.homeEliteBody}
      homeMatchTitle={c.homeMatchTitle}
      homeMatchDescription={c.homeMatchDescription}
      homeTimetableTitle={c.homeTimetableTitle}
      homeTimetableDescription={c.homeTimetableDescription}
      homeDevelopmentLabel={c.homeDevelopmentLabel}
      homeDevelopmentPercent={c.homeDevelopmentPercent}
      homeParentSatisfactionLabel={c.homeParentSatisfactionLabel}
      homeParentSatisfactionPercent={c.homeParentSatisfactionPercent}
      homeTestimonial={c.homeTestimonial}
      homeFaqItems={c.homeFaqItems}
      homePathTitle={c.homePathTitle}
      homePathLead={c.homePathLead}
      homePathTeams={c.homePathTeams}
      homeTrainingTitle={c.homeTrainingTitle}
      homeTrainingLead={c.homeTrainingLead}
      homeJoinTitle={c.homeJoinTitle}
      homeJoinLead={c.homeJoinLead}
      homeJoinButtonLabel={c.homeJoinButtonLabel}
      homeHeroImages={c.homeHeroImages}
      homeSectionImages={c.homeSectionImages}
    />
  );
}
