import { NextResponse } from "next/server";
import { buildRosterTemplateCsv } from "@/lib/roster-csv-import";
import { requireAdmin } from "@/lib/require-admin";

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const csv = buildRosterTemplateCsv();
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="roster-import-template.csv"',
      "Cache-Control": "no-store"
    }
  });
}
