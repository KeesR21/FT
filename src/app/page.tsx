import { KickstarHomePage } from "@/components/kickstar/KickstarHomePage";
import { getCachedSiteContent } from "@/lib/get-site-content-cached";
import { sortNewsPostsByPublishedDesc } from "@/lib/news-posts";

export const dynamic = "force-dynamic";

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
      homeCoachTitle={c.homeCoachTitle}
      homeCoachBody={c.homeCoachBody}
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
