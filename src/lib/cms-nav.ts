/** Public path for “preview in new tab” from CMS editors. */
export const CMS_PAGE_LINKS: { slug: string; label: string; publicPath: string }[] = [
  { slug: "home", label: "Home", publicPath: "/" },
  { slug: "about", label: "About", publicPath: "/about" },
  { slug: "programs", label: "Programs", publicPath: "/programs" },
  { slug: "schedule", label: "Schedule", publicPath: "/schedule" },
  { slug: "our-team", label: "Our Team", publicPath: "/our-team" },
  { slug: "news", label: "News", publicPath: "/news" },
  { slug: "events", label: "Events", publicPath: "/events" },
  { slug: "gallery", label: "Gallery", publicPath: "/gallery" },
  { slug: "contact", label: "Contact", publicPath: "/contact" },
  { slug: "location", label: "Pitch locations", publicPath: "/locations" }
];

export function cmsAdminPath(slug: string) {
  return `/admin/content/${slug}`;
}
