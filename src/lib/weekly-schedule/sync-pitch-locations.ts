/**
 * Synchronises the weekly-schedule pitch store with the pitches registered on
 * the public `/locations` page (stored as `pitchLocations` in the CMS
 * SiteContent). This makes the timetable "Pitch / location" selector show the
 * exact same pitches that are managed under Pitch Locations.
 *
 * Debounced to run at most once per SYNC_COOLDOWN_MS so high-frequency schedule
 * requests don't repeatedly iterate the CMS content and mutate the store.
 */
import { getCachedSiteContent } from "@/lib/get-site-content-cached";
import { weeklySchedule, weeklyScheduleReady } from "@/lib/weekly-schedule/server";

const SYNC_COOLDOWN_MS = 120_000; // 2 minutes — matches CMS cache TTL
let _lastSyncMs = 0;

export async function syncPitchLocationsFromCms(): Promise<void> {
  await weeklyScheduleReady();
  const now = Date.now();
  if (now - _lastSyncMs < SYNC_COOLDOWN_MS) return; // Still fresh — skip.
  _lastSyncMs = now;

  const content = await getCachedSiteContent();
  weeklySchedule.syncPitchLocations(
    (content.pitchLocations ?? []).map((p) => ({ id: p.id, name: p.name }))
  );
}

/**
 * Force an immediate re-sync regardless of cooldown.
 * Call this after admin saves/updates pitch locations in the CMS.
 */
export async function forceSyncPitchLocationsFromCms(): Promise<void> {
  _lastSyncMs = 0;
  await syncPitchLocationsFromCms();
}
