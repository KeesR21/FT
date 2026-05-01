import { AGE_GROUPS, isAgeGroup } from "@/lib/age-groups";
import { parseCsv, toCsv } from "@/lib/csv";

export const ROSTER_TEMPLATE_HEADERS = [
  "playerName",
  "dateOfBirth",
  "parentEmail",
  "ageGroup"
] as const;

export type RosterTemplateHeader = (typeof ROSTER_TEMPLATE_HEADERS)[number];

export type RosterImportCandidateRow = {
  rowNumber: number;
  playerName: string;
  ageGroup?: string;
  dateOfBirth: string;
  parentEmail: string;
};

export type RosterValidationIssue = {
  rowNumber: number;
  field: string;
  message: string;
  severity: "critical" | "warning";
};

export type RosterVerifyResult = {
  totalRows: number;
  validRows: RosterImportCandidateRow[];
  invalidRows: Array<{ rowNumber: number; row: RosterImportCandidateRow; errors: RosterValidationIssue[] }>;
  issues: RosterValidationIssue[];
  missingColumns: string[];
};

function normalizeCell(v: string | undefined): string {
  return String(v ?? "").trim();
}

function normalizeHeader(v: string | undefined): string {
  return normalizeCell(v).toLowerCase();
}

function isIsoDateOnly(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function buildRosterTemplateCsv(): string {
  return toCsv([...ROSTER_TEMPLATE_HEADERS], [
    {
      playerName: "John Doe",
      dateOfBirth: "2014-05-11",
      parentEmail: "parent.john@example.com",
      ageGroup: "U11"
    },
    {
      playerName: "Jane Smith",
      dateOfBirth: "2012-01-24",
      parentEmail: "guardian.jane@example.com",
      ageGroup: "U14A"
    }
  ]);
}

export function verifyRosterCsv(rawCsv: string, existingNameSet: Set<string>, fallbackAgeGroup = AGE_GROUPS[2]): RosterVerifyResult {
  const matrix = parseCsv(rawCsv);
  if (matrix.length === 0) {
    return {
      totalRows: 0,
      validRows: [],
      invalidRows: [],
      issues: [],
      missingColumns: ["playername", "dateofbirth", "parentemail"]
    };
  }

  const headerRow = matrix[0].map(normalizeHeader);
  const idxByCol = new Map<string, number>();
  headerRow.forEach((h, i) => idxByCol.set(h, i));
  const missingColumns = ["playername", "dateofbirth", "parentemail"].filter((c) => !idxByCol.has(c));
  if (missingColumns.length > 0) {
    return { totalRows: Math.max(0, matrix.length - 1), validRows: [], invalidRows: [], issues: [], missingColumns };
  }

  const duplicateInFile = new Set<string>();
  const seenNames = new Set<string>();
  const validRows: RosterImportCandidateRow[] = [];
  const invalidRows: Array<{ rowNumber: number; row: RosterImportCandidateRow; errors: RosterValidationIssue[] }> = [];
  const allIssues: RosterValidationIssue[] = [];

  for (let i = 1; i < matrix.length; i += 1) {
    const cells = matrix[i];
    const rowNumber = i + 1;
    const playerName = normalizeCell(cells[idxByCol.get("playername") ?? -1]);
    const ageGroupRaw = normalizeCell(cells[idxByCol.get("agegroup") ?? -1]);
    const dobRaw = normalizeCell(cells[idxByCol.get("dateofbirth") ?? -1]);
    const parentEmailRaw = normalizeCell(cells[idxByCol.get("parentemail") ?? -1]).toLowerCase();
    const row: RosterImportCandidateRow = {
      rowNumber,
      playerName,
      ageGroup: ageGroupRaw || fallbackAgeGroup,
      dateOfBirth: dobRaw,
      parentEmail: parentEmailRaw
    };

    const errors: RosterValidationIssue[] = [];
    if (!playerName) {
      errors.push({ rowNumber, field: "playerName", message: "Player name is required.", severity: "critical" });
    } else {
      const nameKey = playerName.toLowerCase();
      if (seenNames.has(nameKey)) duplicateInFile.add(nameKey);
      seenNames.add(nameKey);
      if (existingNameSet.has(nameKey)) {
        errors.push({
          rowNumber,
          field: "playerName",
          message: "Duplicate with existing roster player.",
          severity: "critical"
        });
      }
    }
    if (row.ageGroup && !isAgeGroup(row.ageGroup)) {
      errors.push({
        rowNumber,
        field: "ageGroup",
        message: `Invalid age group. Allowed: ${AGE_GROUPS.join(", ")}`,
        severity: "critical"
      });
    }
    if (!row.dateOfBirth) {
      errors.push({
        rowNumber,
        field: "dateOfBirth",
        message: "Date of birth is required.",
        severity: "critical"
      });
    } else if (!isIsoDateOnly(row.dateOfBirth)) {
      errors.push({
        rowNumber,
        field: "dateOfBirth",
        message: "Invalid date format. Use YYYY-MM-DD.",
        severity: "critical"
      });
    }
    if (!row.parentEmail) {
      errors.push({
        rowNumber,
        field: "parentEmail",
        message: "Parent email is required.",
        severity: "critical"
      });
    } else if (!isEmail(row.parentEmail)) {
      errors.push({ rowNumber, field: "parentEmail", message: "Invalid email format.", severity: "critical" });
    }

    if (errors.length > 0) {
      invalidRows.push({ rowNumber, row, errors });
      allIssues.push(...errors);
    } else {
      validRows.push(row);
    }
  }

  if (duplicateInFile.size > 0) {
    for (const entry of invalidRows) {
      if (duplicateInFile.has(entry.row.playerName.toLowerCase())) {
        const issue: RosterValidationIssue = {
          rowNumber: entry.rowNumber,
          field: "playerName",
          message: "Duplicate player name inside the CSV file.",
          severity: "critical"
        };
        const exists = entry.errors.some((e) => e.field === issue.field && e.message === issue.message);
        if (!exists) {
          entry.errors.push(issue);
          allIssues.push(issue);
        }
      }
    }
    for (const row of validRows.slice()) {
      if (duplicateInFile.has(row.playerName.toLowerCase())) {
        const issue: RosterValidationIssue = {
          rowNumber: row.rowNumber,
          field: "playerName",
          message: "Duplicate player name inside the CSV file.",
          severity: "critical"
        };
        invalidRows.push({ rowNumber: row.rowNumber, row, errors: [issue] });
        allIssues.push(issue);
      }
    }
  }

  const validRowNumbers = new Set(
    invalidRows.map((x) => x.rowNumber)
  );
  const filteredValid = validRows.filter((x) => !validRowNumbers.has(x.rowNumber));

  return {
    totalRows: Math.max(0, matrix.length - 1),
    validRows: filteredValid,
    invalidRows: invalidRows.sort((a, b) => a.rowNumber - b.rowNumber),
    issues: allIssues.sort((a, b) => a.rowNumber - b.rowNumber),
    missingColumns
  };
}
