import type { CmsContactInfo, CmsFooterContent, CmsPageSeo } from "@/lib/types";

export function buildDefaultContactInfo(): CmsContactInfo {
  return {
    phones: [{ id: "ph-1", label: "Main office", number: "+250 788 614 755" }],
    emails: [{ id: "em-1", label: "General enquiries", address: "info@ftprlionsacademy.com" }],
    offices: [{ id: "of-1", label: "Head office", address: "Kigali, Rwanda" }],
    socialLinks: [
      { id: "soc-1", platform: "Facebook", url: "https://facebook.com" },
      { id: "soc-2", platform: "Instagram", url: "https://instagram.com" }
    ]
  };
}

export function buildDefaultFooterContent(): CmsFooterContent {
  return {
    brandTitle: "FTPR Lions",
    brandSubtitle: "Football Academy",
    logoSrc: "/logo.jpeg",
    tagline:
      "Professional youth development in Rwanda — structured training, competitive fixtures, and clear communication with families.",
    quickLinks: [],
    copyrightText: "FTPR Lions Football Academy. All rights reserved.",
    motto: "Discipline · Excellence · Character"
  };
}

export function buildDefaultPageSeo(): CmsPageSeo[] {
  return [
    { slug: "home", title: "Home", metaDescription: "FTPR Lions Football Academy — youth development in Rwanda.", heroImage: "/gallery/FTPR_49.JPG", status: "published" },
    { slug: "about", title: "About", metaDescription: "Learn about FTPR Lions Academy mission, vision, and values.", heroImage: "/gallery/FTPR_49.JPG", status: "published" },
    { slug: "programs", title: "Programs", metaDescription: "Age-group programs and development pathway.", heroImage: "/gallery/FTPR_18.JPG", status: "published" },
    { slug: "schedule", title: "Schedule", metaDescription: "Weekly training and match timetable.", heroImage: "/gallery/FTPR_58.JPG", status: "published" },
    { slug: "our-team", title: "Our Team", metaDescription: "Meet our coaching staff.", heroImage: "/gallery/FTPR_25.JPG", status: "published" },
    { slug: "news", title: "News", metaDescription: "Latest academy news and articles.", heroImage: "/gallery/FTPR_38.JPG", status: "published" },
    { slug: "events", title: "Events", metaDescription: "Upcoming academy events.", heroImage: "/gallery/FTPR_58.JPG", status: "published" },
    { slug: "gallery", title: "Gallery", metaDescription: "Photos and videos from FTPR Lions.", heroImage: "/gallery/FTPR_49.JPG", status: "published" },
    { slug: "contact", title: "Contact", metaDescription: "Contact FTPR Lions Academy.", heroImage: "/gallery/FTPR_25.JPG", status: "published" },
    { slug: "locations", title: "Pitch Locations", metaDescription: "Training pitch locations and maps.", heroImage: "/gallery/FTPR_49.JPG", status: "published" }
  ];
}
