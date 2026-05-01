import { readFile } from "fs/promises";
import path from "path";
import { walkSourceFiles, normalizeProjectPath } from "@/lib/audit/context";
import { issue } from "@/lib/audit/issue-factory";
import type { AuditIssue } from "@/lib/audit/types";

function isRouteFile(abs: string): boolean {
  return abs.endsWith(`${path.sep}route.ts`) && abs.includes(`${path.sep}api${path.sep}`);
}

export async function runApiRouteAudit(cwd: string): Promise<AuditIssue[]> {
  const out: AuditIssue[] = [];
  const files = await walkSourceFiles(
    path.join(cwd, "src", "app", "api"),
    isRouteFile,
    { maxFileBytes: 400_000 }
  );

  for (const file of files) {
    const rel = normalizeProjectPath(cwd, file);
    const norm = rel.replace(/\\/g, "/");
    if (!norm.includes("/api/admin/")) continue;
    if (norm.includes("/admin/login/") || norm.endsWith("/admin/login/route.ts")) continue;
    if (norm.includes("/admin/logout/") || norm.endsWith("/admin/logout/route.ts")) continue;

    let content: string;
    try {
      content = await readFile(file, "utf8");
    } catch {
      continue;
    }
    if (!content.includes("requireAdmin")) {
      out.push(
        issue({
          severity: "high",
          title: "Admin API route without requireAdmin()",
          description: "This route lives under /api/admin/ but does not reference requireAdmin, which may expose admin operations.",
          module: "API",
          affectedPath: rel,
          suggestedFix: "Call requireAdmin() at the start of each handler and return 401 if unauthorized."
        })
      );
    }

    if (/\bexport async function POST\b/.test(content) && /req\.json\(\)/.test(content) && !/zod|safeParse/.test(content)) {
      out.push(
        issue({
          severity: "low",
          title: "POST handler may lack in-file schema validation",
          description: "This route reads JSON; no zod/safeParse reference was found in the same file (schema may be imported from elsewhere).",
          module: "API",
          affectedPath: rel,
          suggestedFix: "Ensure all POST bodies are validated, ideally with zod co-located or in a shared schema module."
        })
      );
    }
  }

  out.push(
    issue({
      severity: "info",
      title: `Scanned ${files.length} API route files`,
      description: "Automated static checks for admin auth and request validation are complete.",
      module: "API"
    })
  );

  return out;
}
