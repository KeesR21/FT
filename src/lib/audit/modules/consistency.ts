import { readFile } from "fs/promises";
import path from "path";
import { walkSourceFiles } from "@/lib/audit/context";
import { issue } from "@/lib/audit/issue-factory";
import type { AuditIssue } from "@/lib/audit/types";

function isApiRoute(f: string): boolean {
  return f.endsWith("route.ts") && f.includes(`${path.sep}api${path.sep}`);
}

export async function runConsistencyAudit(cwd: string): Promise<AuditIssue[]> {
  const out: AuditIssue[] = [];
  const files = await walkSourceFiles(path.join(cwd, "src", "app", "api"), isApiRoute, { maxFileBytes: 500_000 });

  let revalidate = 0;
  let mutators = 0;
  for (const file of files) {
    let content: string;
    try {
      content = await readFile(file, "utf8");
    } catch {
      continue;
    }
    if (/revalidateAdminViews|revalidatePath|revalidateTag/.test(content)) revalidate += 1;
    if (/\bexport async function (POST|PATCH|PUT|DELETE)\b/.test(content)) mutators += 1;
  }

  out.push(
    issue({
      severity: "info",
      title: "Cache and admin UI refresh (static)",
      description: `Found revalidate* helpers in ${revalidate} of ${files.length} API route files. Mutating handlers present in ~${mutators} (approximate).`,
      module: "Data consistency",
      suggestedFix: "After admin mutations, call revalidateAdminViews or targeted revalidatePath to avoid stale RSC or list data."
    })
  );

  const hasCentralPay = path.join(cwd, "src/lib/admin-payment-ui.ts");
  try {
    await readFile(hasCentralPay, "utf8");
    out.push(
      issue({
        severity: "info",
        title: "Centralized admin payment UI module exists",
        description: "admin-payment-ui helps keep status badges and action rules consistent across finance pages.",
        module: "Data consistency"
      })
    );
  } catch {
    out.push(
      issue({
        severity: "medium",
        title: "admin-payment-ui.ts not found",
        description: "Finance UI may diverge if badge logic is duplicated per page.",
        module: "Data consistency"
      })
    );
  }

  return out;
}
