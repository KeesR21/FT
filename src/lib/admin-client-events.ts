/** Dispatched after registration decisions, finance actions, and on a background timer while the admin is signed in. */
export const ADMIN_OVERVIEW_REFRESH = "ftpr-admin-overview-refresh";

/** Interval for background sync (visible tab only) — new applications, messages, invoice badges, client lists. */
export const ADMIN_BACKGROUND_POLL_INTERVAL_MS = 30_000;

export type AdminOverviewRefreshDetail = {
  /**
   * True for timer / visibility catch-up: client lists refetch without full-screen loaders;
   * {@link AdminServerRefreshOnMutation} skips `router.refresh()` so the whole admin tree is not re-fetched every tick.
   */
  silent?: boolean;
};
