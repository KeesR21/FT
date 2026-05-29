import { PUBLIC_EVENTS_PAGE_ENABLED } from "@/lib/site-features";

const ALL_PUBLIC_NAV_LINKS = [
  ["/", "Home"],
  ["/about", "About"],
  ["/programs", "Programs"],
  ["/schedule", "Schedule"],
  ["/our-team", "Our Team"],
  ["/news", "News"],
  ["/events", "Events"],
  ["/gallery", "Gallery"],
  ["/contact", "Contact"],
  ["/locations", "Pitch locations"]
] as const;

/** Primary nav/footer links respecting site feature flags. */
export function getPublicNavLinks(): ReadonlyArray<readonly [string, string]> {
  return ALL_PUBLIC_NAV_LINKS.filter(([href]) => PUBLIC_EVENTS_PAGE_ENABLED || href !== "/events");
}
