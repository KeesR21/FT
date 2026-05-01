import { NextResponse } from "next/server";
import { getCachedSiteContent } from "@/lib/get-site-content-cached";

/** Public read-only CMS snapshot (no auth). */
export async function GET() {
  return NextResponse.json(await getCachedSiteContent(), {
    headers: { "Cache-Control": "no-store, max-age=0" }
  });
}
