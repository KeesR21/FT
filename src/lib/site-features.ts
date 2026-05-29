import type { CmsFaqItem } from "@/lib/types";

/**
 * Public marketing site: show player registration (/register), parent portal promos,
 * and related CTAs. Routes and components stay in the repo — set to `true` to re-enable.
 */
export const PUBLIC_REGISTRATION_ENABLED = false;

/**
 * Public marketing site: show /events (open days, camps, fixtures list).
 * Set to `true` to re-enable the Events page and nav links.
 */
export const PUBLIC_EVENTS_PAGE_ENABLED = false;

/** FAQ entries that only make sense when registration is offered on the public site. */
export function filterPublicRegistrationFaqItems(items: CmsFaqItem[]): CmsFaqItem[] {
  if (PUBLIC_REGISTRATION_ENABLED) return items;
  return items.filter((item) => !isRegistrationFaqItem(item));
}

function isRegistrationFaqItem(item: CmsFaqItem): boolean {
  const text = `${item.title} ${item.content}`.toLowerCase();
  return /\bregister\b/.test(text) || /\bregistration\b/.test(text);
}
