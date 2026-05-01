import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { verifyRosterCsv } from "@/lib/roster-csv-import";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export async function POST(req: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ message: "Expected multipart form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Missing file upload (field name: file)" }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return NextResponse.json({ message: "Only .csv files are allowed." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ message: "CSV is too large. Maximum size is 5 MB." }, { status: 400 });
  }

  let csvText = "";
  try {
    csvText = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ message: "CSV must be UTF-8 encoded." }, { status: 400 });
  }

  const existingPlayers = await db.listPlayers({ includeWithdrawn: true });
  const existingNameSet = new Set(existingPlayers.map((p) => p.playerName.trim().toLowerCase()));
  const result = verifyRosterCsv(csvText, existingNameSet);
  const friendlyMissing = result.missingColumns.map((c) => {
    if (c === "playername") return "playerName";
    if (c === "dateofbirth") return "dateOfBirth";
    if (c === "parentemail") return "parentEmail";
    return c;
  });

  return NextResponse.json({
    summary: {
      totalRows: result.totalRows,
      validRows: result.validRows.length,
      invalidRows: result.invalidRows.length,
      issues: result.issues.length
    },
    missingColumns: friendlyMissing,
    validRows: result.validRows,
    invalidRows: result.invalidRows,
    issues: result.issues
  });
}
