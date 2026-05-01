import { revalidatePath } from "next/cache";

/**
 * Call from Route Handlers after admin mutations so server-rendered `/admin/**` pages
 * (dashboard, etc.) are not served from a stale Full Route / RSC cache after navigation.
 */
export function revalidateAdminViews() {
  try {
    revalidatePath("/admin", "layout");
  } catch {
    /* e.g. invoked outside a request context — ignore */
  }
}
