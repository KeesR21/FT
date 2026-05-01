import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { revalidateAdminViews } from "@/lib/revalidate-admin";
import { requireAdmin } from "@/lib/require-admin";
import { AGE_GROUPS, isAgeGroup } from "@/lib/age-groups";

const importRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  playerName: z.string().min(1),
  ageGroup: z.string().optional()
});

const runImportSchema = z.object({
  rows: z.array(importRowSchema),
  allowPartial: z.boolean().optional()
});

export async function POST(req: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Expected JSON body" }, { status: 400 });
  }

  const parsed = runImportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid import payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const rows = parsed.data.rows.map((r) => ({
    rowNumber: r.rowNumber,
    playerName: r.playerName.trim(),
    ageGroup: r.ageGroup && isAgeGroup(r.ageGroup) ? r.ageGroup : AGE_GROUPS[2]
  }));

  const seen = new Set<string>();
  const validRows: typeof rows = [];
  const invalidRows: Array<{ rowNumber: number; field: string; message: string }> = [];

  const existing = await db.listPlayers({ includeWithdrawn: true });
  const existingSet = new Set(existing.map((p) => p.playerName.trim().toLowerCase()));

  for (const row of rows) {
    if (!row.playerName) {
      invalidRows.push({ rowNumber: row.rowNumber, field: "playerName", message: "Player name is required." });
      continue;
    }
    const key = row.playerName.toLowerCase();
    if (seen.has(key)) {
      invalidRows.push({ rowNumber: row.rowNumber, field: "playerName", message: "Duplicate name in import payload." });
      continue;
    }
    if (existingSet.has(key)) {
      invalidRows.push({ rowNumber: row.rowNumber, field: "playerName", message: "Player already exists in roster." });
      continue;
    }
    seen.add(key);
    validRows.push(row);
  }

  if (invalidRows.length > 0 && !parsed.data.allowPartial) {
    return NextResponse.json(
      {
        message: "Import blocked: fix validation issues or retry with partial import.",
        summary: { requested: rows.length, valid: validRows.length, invalid: invalidRows.length },
        invalidRows
      },
      { status: 400 }
    );
  }

  if (validRows.length === 0) {
    return NextResponse.json({ message: "No valid rows to import." }, { status: 400 });
  }

  const importResult = await db.createRosterPlayersFromNames({
    rows: validRows.map((x) => ({ playerName: x.playerName, ageGroup: x.ageGroup || AGE_GROUPS[2] }))
  });

  revalidateAdminViews();

  console.info("[roster-import]", {
    timestamp: new Date().toISOString(),
    uploadedBy: process.env.ADMIN_EMAIL ?? "admin-session",
    requestedRows: rows.length,
    importedRows: importResult.created.length,
    skippedRows: importResult.skippedNames.length,
    invalidRows: invalidRows.length
  });

  return NextResponse.json({
    message: "Roster import completed.",
    summary: {
      requested: rows.length,
      imported: importResult.created.length,
      skipped: importResult.skippedNames.length,
      invalid: invalidRows.length
    },
    invalidRows
  });
}
