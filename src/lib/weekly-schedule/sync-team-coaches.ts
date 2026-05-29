/**
 * Synchronises the weekly-schedule coach store with the coaches listed on the
 * public `/our-team` page (stored as `teamMembers` in the CMS SiteContent).
 *
 * This must be called (and awaited) at the start of every API route that reads
 * or validates coaches so that the in-memory store always reflects the current
 * team page without requiring a separate coach-management UI.
 */
import { getCachedSiteContent } from "@/lib/get-site-content-cached";
import { weeklySchedule } from "@/lib/weekly-schedule/server";

export async function syncTeamCoachesFromCms(): Promise<void> {
  const content = await getCachedSiteContent();
  weeklySchedule.syncTeamCoaches(
    content.teamMembers.map((m) => ({ id: m.id, name: m.name }))
  );
}
