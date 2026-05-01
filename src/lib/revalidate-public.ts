import { revalidatePath, revalidateTag } from "next/cache";
import { SITE_CONTENT_CACHE_TAG } from "@/lib/get-site-content-cached";

const PATHS = [
  "/",
  "/schedule",
  "/fixtures",
  "/about",
  "/contact",
  "/programs",
  "/register",
  "/teams",
  "/our-team",
  "/news",
  "/events",
  "/gallery",
  "/locations"
] as const;

/** Revalidate the layout so nested routes (e.g. dynamic segments) pick up CMS changes. */
const LAYOUT_SEGMENT_PATHS = new Set<string>(["/gallery", "/contact", "/locations"]);

/** Call after admin mutations so public routes pick up mock-db / CMS changes (ISR/cache). */
export function revalidatePublicSite() {
  try {
    revalidateTag(SITE_CONTENT_CACHE_TAG);
  } catch {
    /* outside request context */
  }
  for (const p of PATHS) {
    try {
      if (LAYOUT_SEGMENT_PATHS.has(p)) {
        revalidatePath(p, "layout");
      } else {
        revalidatePath(p);
      }
    } catch {
      /* e.g. called outside request context — ignore */
    }
  }
}
