import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { parseCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { revalidateAdminViews } from "@/lib/revalidate-admin";
import { requireAdmin } from "@/lib/require-admin";
import { getAgeGroup, jsonMessage } from "@/lib/utils";

type UploadRow = {
  playerName: string;
  dateOfBirth: string;
  heightCm: number;
  weightKg: number;
  parentName: string;
  phoneNumber: string;
  email: string;
  address: string;
};

const REQUIRED = ["playername", "dateofbirth", "heightcm", "weightkg", "parentname", "phonenumber", "email", "address"];

function normalizeHeader(v: unknown) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function normalizeCell(v: unknown) {
  return String(v ?? "").trim();
}

function fromRecords(records: Record<string, unknown>[]): UploadRow[] {
  return records.map((r) => ({
    playerName: normalizeCell(r.playerName),
    dateOfBirth: normalizeCell(r.dateOfBirth),
    heightCm: Number(r.heightCm),
    weightKg: Number(r.weightKg),
    parentName: normalizeCell(r.parentName),
    phoneNumber: normalizeCell(r.phoneNumber),
    email: normalizeCell(r.email),
    address: normalizeCell(r.address)
  }));
}

function fromCsv(raw: string): UploadRow[] {
  const rows = parseCsv(raw);
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((line) => {
    const rec: Record<string, string> = {};
    headers.forEach((h, i) => {
      rec[h] = line[i] ?? "";
    });
    return {
      playerName: rec.playerName?.trim() ?? "",
      dateOfBirth: rec.dateOfBirth?.trim() ?? "",
      heightCm: Number(rec.heightCm),
      weightKg: Number(rec.weightKg),
      parentName: rec.parentName?.trim() ?? "",
      phoneNumber: rec.phoneNumber?.trim() ?? "",
      email: rec.email?.trim() ?? "",
      address: rec.address?.trim() ?? ""
    };
  });
}

function validateRows(rows: UploadRow[]) {
  const issues: string[] = [];
  const clean: UploadRow[] = [];
  rows.forEach((row, index) => {
    const rowLabel = `Row ${index + 2}`;
    if (!row.playerName) issues.push(`${rowLabel}: playerName is required.`);
    if (!row.parentName) issues.push(`${rowLabel}: parentName is required.`);
    if (!row.phoneNumber) issues.push(`${rowLabel}: phoneNumber is required.`);
    if (!row.address) issues.push(`${rowLabel}: address is required.`);
    if (!row.email || !row.email.includes("@")) issues.push(`${rowLabel}: valid email is required.`);
    if (!row.dateOfBirth || Number.isNaN(Date.parse(row.dateOfBirth))) issues.push(`${rowLabel}: valid dateOfBirth is required.`);
    if (!Number.isFinite(row.heightCm) || row.heightCm <= 0) issues.push(`${rowLabel}: heightCm must be > 0.`);
    if (!Number.isFinite(row.weightKg) || row.weightKg <= 0) issues.push(`${rowLabel}: weightKg must be > 0.`);
    if (issues.length === 0 || !issues[issues.length - 1].startsWith(rowLabel)) clean.push(row);
  });
  return { clean, issues };
}

export async function POST(req: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(jsonMessage("Missing file upload (use field name 'file')"), { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const rawName = (file.name || "").toLowerCase();
  let rows: UploadRow[] = [];
  let headerCheck: string[] = [];

  if (rawName.endsWith(".csv")) {
    const content = new TextDecoder().decode(bytes);
    const parsed = parseCsv(content);
    headerCheck = (parsed[0] ?? []).map(normalizeHeader);
    rows = fromCsv(content);
  } else if (rawName.endsWith(".xlsx") || rawName.endsWith(".xls") || rawName.endsWith(".xlsm")) {
    const wb = XLSX.read(Buffer.from(bytes), { type: "buffer" });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json(jsonMessage("Workbook has no sheets"), { status: 400 });
    }
    const ws = wb.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][];
    headerCheck = (matrix[0] ?? []).map(normalizeHeader);
    const records = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, unknown>[];
    rows = fromRecords(records);
  } else {
    return NextResponse.json(jsonMessage("Unsupported file type. Upload CSV or Excel (.xlsx/.xls)."), { status: 400 });
  }

  for (const required of REQUIRED) {
    if (!headerCheck.includes(required)) {
      return NextResponse.json(jsonMessage(`Missing required header: ${required}`), { status: 400 });
    }
  }

  const { clean, issues } = validateRows(rows);
  if (issues.length > 0) {
    return NextResponse.json(jsonMessage("Roster upload validation failed", { issues }), { status: 400 });
  }

  const existingPlayers = await db.listPlayers({ includeWithdrawn: true });
  const existingKeys = new Set<string>();
  await Promise.all(
    existingPlayers.map(async (p) => {
      const parent = await db.getParentByPlayerId(p.id);
      existingKeys.add(
        `${p.playerName.trim().toLowerCase()}::${p.dateOfBirth.slice(0, 10)}::${(parent?.email ?? "").toLowerCase()}`
      );
    })
  );

  let created = 0;
  let skipped = 0;
  for (const row of clean) {
    const candidateKey = `${row.playerName.trim().toLowerCase()}::${row.dateOfBirth.slice(0, 10)}::${row.email.toLowerCase()}`;
    if (existingKeys.has(candidateKey)) {
      skipped += 1;
      continue;
    }
    const ageGroup = getAgeGroup(row.dateOfBirth);
    await db.createRegistration({
      playerName: row.playerName,
      dateOfBirth: row.dateOfBirth,
      ageGroup,
      heightCm: row.heightCm,
      weightKg: row.weightKg,
      parent: {
        parentName: row.parentName,
        phoneNumber: row.phoneNumber,
        email: row.email,
        address: row.address
      }
    });
    existingKeys.add(candidateKey);
    created += 1;
  }

  revalidateAdminViews();
  return NextResponse.json({
    message: "Roster import completed",
    uploadedRows: rows.length,
    created,
    skipped
  });
}
