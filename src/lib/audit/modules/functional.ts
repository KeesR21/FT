import { readFile, access } from "fs/promises";
import path from "path";
import { issue } from "@/lib/audit/issue-factory";
import type { AuditIssue } from "@/lib/audit/types";

const KEY_FILES = [
  "src/lib/admin-payment-ui.ts",
  "src/lib/roster-csv-import.ts",
  "src/lib/invoice-pdf.ts",
  "src/lib/invoice-log-store.ts",
  "src/app/api/admin/invoices/route.ts",
  "src/app/api/admin/players/import/verify/route.ts",
  "src/app/api/admin/players/import/run/route.ts"
];

export async function runFunctionalAudit(cwd: string): Promise<AuditIssue[]> {
  const out: AuditIssue[] = [];

  for (const rel of KEY_FILES) {
    const full = path.join(cwd, rel);
    try {
      await access(full);
      await readFile(full, "utf8"); /* ensure readable */
    } catch {
      out.push(
        issue({
          severity: "high",
          title: "Core finance/CSV file missing or unreadable",
          description: `Expected file at ${rel} for key workflows (payments, CSV, invoices).`,
          module: "Functional",
          affectedPath: rel
        })
      );
    }
  }

  out.push(
    issue({
      severity: "info",
      title: "Key workflow files present (static check)",
      description: "This audit does not execute E2E browser tests; it verifies critical modules exist on disk.",
      module: "Functional"
    })
  );

  return out;
}
