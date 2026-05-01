import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";

/** Badge counts for admin chrome — two indexed counts, no full roster/payment payloads. */
export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const summary = await db.adminShellSummary();
  return NextResponse.json(summary);
}
