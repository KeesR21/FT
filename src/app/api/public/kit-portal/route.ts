import { NextResponse } from "next/server";
import { getKitOrderingPeriod } from "@/lib/kit-period-store";

/**
 * Lightweight public-read endpoint used by the navbar and homepage banner to
 * decide whether to surface the "Order Kit" CTA.
 */
export async function GET() {
  const period = await getKitOrderingPeriod();
  return NextResponse.json({
    enabled: period.enabled,
    announcement: period.announcement,
    openedAt: period.openedAt
  });
}
