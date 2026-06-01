/**
 * Synchronises the weekly-schedule coach store with the coaches listed on the
 * public `/our-team` page (stored as `teamMembers` in the CMS SiteContent).
 *
 * Debounced to run at most once per SYNC_COOLDOWN_MS so that high-frequency
 * public schedule requests (e.g. every user who loads the schedule page)
 * don't repeatedly iterate through the entire CMS content and mutate the
 * in-memory coach store. The CMS itself is only re-cached every 120 s, so
 * syncing more often than that provides zero benefit.
 */
import { getCachedSiteContent } from "@/lib/get-site-content-cached";
import { weeklySchedule, weeklyScheduleReady } from "@/lib/weekly-schedule/server";

const SYNC_COOLDOWN_MS = 120_000; // 2 minutes — matches CMS cache TTL
let _lastSyncMs = 0;

export async function syncTeamCoachesFromCms(): Promise<void> {
  await weeklyScheduleReady();
  const now = Date.now();
  if (now - _lastSyncMs < SYNC_COOLDOWN_MS) return; // Still fresh — skip.
  _lastSyncMs = now;

  const content = await getCachedSiteContent();
  weeklySchedule.syncTeamCoaches(
    content.teamMembers.map((m) => ({ id: m.id, name: m.name }))
  );
}

/**
 * Force an immediate re-sync regardless of cooldown.
 * Call this after admin saves/updates team members in the CMS.
 */
export async function forceSyncTeamCoachesFromCms(): Promise<void> {
  _lastSyncMs = 0;
  await syncTeamCoachesFromCms();
}
