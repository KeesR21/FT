import { readFile } from "fs/promises";
import path from "path";
import { walkSourceFiles } from "@/lib/audit/context";
import { issue } from "@/lib/audit/issue-factory";
import type { AuditIssue } from "@/lib/audit/types";

function inAdminUI(abs: string): boolean {
  return (abs.includes(`${path.sep}admin${path.sep}`) || abs.includes("components\\admin") || abs.includes("components/admin")) && (abs.endsWith(".tsx") || abs.endsWith(".ts"));
}

export async function runUxAudit(cwd: string): Promise<AuditIssue[]> {
  const out: AuditIssue[] = [];
  const files = await walkSourceFiles(path.join(cwd, "src"), inAdminUI, { maxFileBytes: 600_000 });

  let withAria = 0;
  let withRole = 0;
  let buttons = 0;
  for (const file of files) {
    let content: string;
    try {
      content = await readFile(file, "utf8");
    } catch {
      continue;
    }
    if (/aria-[a-z]+=/.test(content) || /aria-\{/.test(content)) withAria += 1;
    if (/\brole=/.test(content)) withRole += 1;
    if (/<button\b/.test(content) || /role=\"button\"/.test(content)) buttons += 1;
  }

  out.push(
    issue({
      severity: "info",
      title: "Admin UI accessibility (heuristic)",
      description: `Scanned ${files.length} admin-related source files. ${withAria} files reference ARIA, ${withRole} use role=, ${buttons} mention buttons (coarse string match).`,
      module: "UI/UX",
      suggestedFix: "Prefer labels for inputs, focus states for modals, and test keyboard navigation on critical flows."
    })
  );

  const hasLoading = await countLoadingPatterns(files);
  if (files.length > 0 && hasLoading < files.length * 0.1) {
    out.push(
      issue({
        severity: "low",
        title: "Some admin views may lack obvious loading state",
        description: "Only a few files use loading/Loading/spinner strings; ensure async pages show progress where users wait.",
        module: "UI/UX",
        suggestedFix: "Add skeletons, spinners, or disabled primary actions while mutations run."
      })
    );
  }

  return out;
}

async function countLoadingPatterns(files: string[]) {
  let n = 0;
  for (const file of files) {
    let content: string;
    try {
      content = await readFile(file, "utf8");
    } catch {
      continue;
    }
    if (/\bloading\b|isLoading|setLoading|spinner|Skeleton/i.test(content)) n += 1;
  }
  return n;
}
