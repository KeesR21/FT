import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import type { SiteContent } from "@/lib/types";
import { requireAdmin } from "@/lib/require-admin";
import { revalidateAdminViews } from "@/lib/revalidate-admin";
import { revalidatePublicSite } from "@/lib/revalidate-public";
import { forceSyncTeamCoachesFromCms } from "@/lib/weekly-schedule/sync-team-coaches";
import { forceSyncPitchLocationsFromCms } from "@/lib/weekly-schedule/sync-pitch-locations";
import { jsonMessage } from "@/lib/utils";

const highlightItem = z.object({ id: z.string(), title: z.string(), body: z.string() });
const homeCounter = z.object({
  id: z.string(),
  end: z.number().nonnegative(),
  suffix: z.string(),
  title: z.string(),
  numberVariant: z.enum(["default", "accent"]).optional()
});
const faqItem = z.object({ id: z.string(), title: z.string().min(2), content: z.string().min(2) });
const homeTestimonial = z.object({
  eyebrow: z.string(),
  quote: z.string(),
  name: z.string(),
  role: z.string(),
  imageSrc: z.string(),
  imageAlt: z.string()
});
const homeHeroImages = z.object({
  logo: z.string()
});
const homeSectionImages = z.object({
  pathway: z.string(),
  training: z.string(),
  iconLogo: z.string()
});
const programGroup = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  image: z.string().optional()
});
const pathwayLineStep = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string()
});
const teamMember = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  description: z.string(),
  image: z.string()
});
const newsPost = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  image: z.string(),
  date: z.string(),
  /** ISO 8601 — used for sort order on the site */
  publishedAt: z.string().optional(),
  author: z.string().optional()
});
const eventItem = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  startsAt: z.string(),
  endsAt: z.string().optional(),
  location: z.string().optional(),
  image: z.string().optional()
});
const galleryAlbumImage = z.object({ id: z.string(), src: z.string() });
const galleryAlbum = z.object({
  id: z.string(),
  title: z.string(),
  coverSrc: z.string(),
  images: z.array(galleryAlbumImage)
});
const pitchLocation = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string().optional(),
  address: z.string().optional(),
  line: z.string().optional(),
  lat: z.number(),
  lng: z.number(),
  mapEmbedUrl: z.string().optional()
});
const aboutTile = z.object({ id: z.string(), title: z.string(), body: z.string() });
const aboutGalleryItem = z.object({ id: z.string(), src: z.string(), caption: z.string() });

// Site-settings objects (contactInfo, footerContent, testimonials, etc.)
const socialLink = z.object({ id: z.string(), platform: z.string(), url: z.string() });
const contactPhone = z.object({ id: z.string(), label: z.string(), number: z.string() });
const contactEmail = z.object({ id: z.string(), label: z.string(), address: z.string() });
const contactOffice = z.object({ id: z.string(), label: z.string(), address: z.string() });
const contactInfoSchema = z.object({
  phones: z.array(contactPhone),
  emails: z.array(contactEmail),
  offices: z.array(contactOffice),
  socialLinks: z.array(socialLink)
});
const footerLink = z.object({ id: z.string(), label: z.string(), href: z.string() });
const footerContentSchema = z.object({
  brandTitle: z.string(),
  brandSubtitle: z.string(),
  logoSrc: z.string(),
  tagline: z.string(),
  quickLinks: z.array(footerLink),
  copyrightText: z.string(),
  motto: z.string()
});
const testimonialSchema = z.object({
  id: z.string(),
  type: z.enum(["parent", "player", "partner"]),
  quote: z.string(),
  name: z.string(),
  role: z.string(),
  imageSrc: z.string().optional(),
  status: z.enum(["draft", "published"]).optional(),
  deletedAt: z.string().nullable().optional()
});
const sponsorSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  logoSrc: z.string(),
  websiteUrl: z.string(),
  status: z.enum(["draft", "published"]).optional(),
  deletedAt: z.string().nullable().optional()
});
const announcementSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  expiresAt: z.string().optional(),
  status: z.enum(["draft", "published"]).optional(),
  deletedAt: z.string().nullable().optional()
});
const pageSeoSchema = z.object({
  slug: z.string(),
  title: z.string(),
  metaDescription: z.string(),
  ogImage: z.string().optional(),
  keywords: z.string().optional(),
  heroImage: z.string().optional(),
  status: z.enum(["draft", "published"]).optional()
});

const patchSchema = z.object({
  academyInfo: z.string().optional(),
  contactBlurb: z.string().optional(),
  homeWelcomePill: z.string().optional(),
  homeHeroHeading: z.string().optional(),
  homeHeroImage: z.string().optional(),
  homeHeroImages: homeHeroImages.optional(),
  homeSectionImages: homeSectionImages.optional(),
  homeHighlightItems: z.array(highlightItem).optional(),
  homeCounters: z.array(homeCounter).optional(),
  homeCoachTitle: z.string().optional(),
  homeCoachBody: z.string().optional(),
  homeEliteTitle: z.string().optional(),
  homeEliteBody: z.string().optional(),
  homeMatchTitle: z.string().optional(),
  homeMatchDescription: z.string().optional(),
  homeTimetableTitle: z.string().optional(),
  homeTimetableDescription: z.string().optional(),
  homeDevelopmentLabel: z.string().optional(),
  homeDevelopmentPercent: z.number().min(0).max(100).optional(),
  homeParentSatisfactionLabel: z.string().optional(),
  homeParentSatisfactionPercent: z.number().min(0).max(100).optional(),
  homeTestimonial: homeTestimonial.optional(),
  homeFaqItems: z.array(faqItem).optional(),
  homePathTitle: z.string().optional(),
  homePathLead: z.string().optional(),
  homePathTeams: z.array(z.string()).optional(),
  homeTrainingTitle: z.string().optional(),
  homeTrainingLead: z.string().optional(),
  homeJoinTitle: z.string().optional(),
  homeJoinLead: z.string().optional(),
  homeJoinButtonLabel: z.string().optional(),
  schedulePagePill: z.string().optional(),
  scheduleHeroImage: z.string().optional(),
  schedulePageTitle: z.string().optional(),
  schedulePageLead: z.string().optional(),
  scheduleTimelineTitle: z.string().optional(),
  scheduleTimelineLead: z.string().optional(),
  scheduleLocationTitle: z.string().optional(),
  scheduleLocationLead: z.string().optional(),
  scheduleLocationImage: z.string().optional(),
  scheduleParentBlurb: z.string().optional(),
  aboutPagePill: z.string().optional(),
  aboutPageTitle: z.string().optional(),
  aboutHeroImage: z.string().optional(),
  aboutPageLead: z.string().optional(),
  aboutVisionTitle: z.string().optional(),
  aboutMission: z.string().optional(),
  aboutVision: z.string().optional(),
  aboutHistory: z.string().optional(),
  aboutManagementMessage: z.string().optional(),
  aboutGalleryItems: z.array(aboutGalleryItem).optional(),
  aboutValuesTitle: z.string().optional(),
  aboutPageImage: z.string().optional(),
  aboutSplitTitle: z.string().optional(),
  aboutSplitLead: z.string().optional(),
  aboutTiles: z.array(aboutTile).optional(),
  aboutCtaTitle: z.string().optional(),
  aboutCtaLead: z.string().optional(),
  programsPagePill: z.string().optional(),
  programsHeroImage: z.string().optional(),
  programsPageTitle: z.string().optional(),
  programsPageLead: z.string().optional(),
  programsSpotlightTitle: z.string().optional(),
  programsSpotlightLead: z.string().optional(),
  programsSpotlightItems: z.array(aboutGalleryItem).optional(),
  programsPathwayTitle: z.string().optional(),
  programsPathwayBlurb: z.string().optional(),
  programsPathwayLineTitle: z.string().optional(),
  programsPathwayLineLead: z.string().optional(),
  programsPathwayLineScrollLabel: z.string().optional(),
  programsPathwayLineItems: z.array(pathwayLineStep).optional(),
  programGroups: z.array(programGroup).optional(),
  programsSideImage: z.string().optional(),
  programsSplitTitle: z.string().optional(),
  programsSplitLead: z.string().optional(),
  programsCtaTitle: z.string().optional(),
  programsCtaLead: z.string().optional(),
  ourTeamPageTitle: z.string().optional(),
  ourTeamPageLead: z.string().optional(),
  teamMembers: z.array(teamMember).optional(),
  newsPageTitle: z.string().optional(),
  newsPageLead: z.string().optional(),
  newsPosts: z.array(newsPost).optional(),
  eventsPageTitle: z.string().optional(),
  eventsPageLead: z.string().optional(),
  events: z.array(eventItem).optional(),
  galleryPageTitle: z.string().optional(),
  galleryPageLead: z.string().optional(),
  galleryAlbums: z.array(galleryAlbum).optional(),
  locationPageTitle: z.string().optional(),
  locationPageLead: z.string().optional(),
  pitchLocations: z.array(pitchLocation).optional(),
  locationMapEmbedUrl: z.string().optional(),
  locationAddressLine: z.string().optional(),
  contactPageLead: z.string().optional(),
  contactOfficeHours: z.string().optional(),
  contactInfo: contactInfoSchema.optional(),
  footerContent: footerContentSchema.optional(),
  testimonials: z.array(testimonialSchema).optional(),
  sponsors: z.array(sponsorSchema).optional(),
  announcements: z.array(announcementSchema).optional(),
  pageSeo: z.array(pageSeoSchema).optional(),
});

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  return NextResponse.json(await db.getSiteContent());
}

export async function PATCH(req: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(jsonMessage("Expected JSON body"), { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(jsonMessage("Invalid content payload"), { status: 400 });
  }
  const d = parsed.data;

  const keys = [
    "academyInfo",
    "contactBlurb",
    "homeWelcomePill",
    "homeHeroHeading",
    "homeHeroImage",
    "homeHeroImages",
    "homeSectionImages",
    "homeHighlightItems",
    "homeCounters",
    "homeCoachTitle",
    "homeCoachBody",
    "homeEliteTitle",
    "homeEliteBody",
    "homeMatchTitle",
    "homeMatchDescription",
    "homeTimetableTitle",
    "homeTimetableDescription",
    "homeDevelopmentLabel",
    "homeDevelopmentPercent",
    "homeParentSatisfactionLabel",
    "homeParentSatisfactionPercent",
    "homeTestimonial",
    "homeFaqItems",
    "homePathTitle",
    "homePathLead",
    "homePathTeams",
    "homeTrainingTitle",
    "homeTrainingLead",
    "homeJoinTitle",
    "homeJoinLead",
    "homeJoinButtonLabel",
    "schedulePagePill",
    "scheduleHeroImage",
    "schedulePageTitle",
    "schedulePageLead",
    "scheduleTimelineTitle",
    "scheduleTimelineLead",
    "scheduleLocationTitle",
    "scheduleLocationLead",
    "scheduleLocationImage",
    "scheduleParentBlurb",
    "aboutPagePill",
    "aboutPageTitle",
    "aboutHeroImage",
    "aboutPageLead",
    "aboutVisionTitle",
    "aboutMission",
    "aboutVision",
    "aboutHistory",
    "aboutManagementMessage",
    "aboutGalleryItems",
    "aboutValuesTitle",
    "aboutPageImage",
    "aboutSplitTitle",
    "aboutSplitLead",
    "aboutTiles",
    "aboutCtaTitle",
    "aboutCtaLead",
    "programsPagePill",
    "programsHeroImage",
    "programsPageTitle",
    "programsPageLead",
    "programsSpotlightTitle",
    "programsSpotlightLead",
    "programsSpotlightItems",
    "programsPathwayTitle",
    "programsPathwayBlurb",
    "programsPathwayLineTitle",
    "programsPathwayLineLead",
    "programsPathwayLineScrollLabel",
    "programsPathwayLineItems",
    "programGroups",
    "programsSideImage",
    "programsSplitTitle",
    "programsSplitLead",
    "programsCtaTitle",
    "programsCtaLead",
    "ourTeamPageTitle",
    "ourTeamPageLead",
    "teamMembers",
    "newsPageTitle",
    "newsPageLead",
    "newsPosts",
    "eventsPageTitle",
    "eventsPageLead",
    "events",
    "galleryPageTitle",
    "galleryPageLead",
    "galleryAlbums",
    "locationPageTitle",
    "locationPageLead",
    "pitchLocations",
    "locationMapEmbedUrl",
    "locationAddressLine",
    "contactPageLead",
    "contactOfficeHours",
    "contactInfo",
    "footerContent",
    "testimonials",
    "sponsors",
    "announcements",
    "pageSeo"
  ] as const;

  const patch: Partial<SiteContent> = {};
  for (const k of keys) {
    const v = d[k as keyof typeof d];
    if (v !== undefined) (patch as Record<string, unknown>)[k] = v;
  }
  if (Object.keys(patch).length > 0) {
    await db.updateSiteContent(patch);
    // When the team roster changes, immediately re-sync the schedule coach store
    // so that new/removed coaches are reflected without waiting for the cooldown.
    if (patch.teamMembers) {
      void forceSyncTeamCoachesFromCms();
    }
    // When pitch locations change, re-sync the schedule pitch store so the
    // timetable selector matches the registered pitches immediately.
    if (patch.pitchLocations) {
      void forceSyncPitchLocationsFromCms();
    }
  }

  revalidatePublicSite();
  revalidateAdminViews();
  return NextResponse.json(await db.getSiteContent());
}
