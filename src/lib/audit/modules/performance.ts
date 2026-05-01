import { readFile } from "fs/promises";
import path from "path";
import { readdir } from "fs/promises";
import { walkSourceFiles, normalizeProjectPath } from "@/lib/audit/context";
import { issue } from "@/lib/audit/issue-factory";
import type { AuditIssue } from "@/lib/audit/types";

function isPageOrComponent(f: string): boolean {
  return f.endsWith(".tsx") && (f.includes(`${path.sep}app${path.sep}`) || f.includes(`${path.sep}components${path.sep}`));
}

export async function runPerformanceAudit(cwd: string): Promise<AuditIssue[]> {
  const out: AuditIssue[] = [];

  let pkg: { dependencies?: Record<string, string> };
  try {
    const raw = await readFile(path.join(cwd, "package.json"), "utf8");
    pkg = JSON.parse(raw);
  } catch {
    out.push(
      issue({
        severity: "medium",
        title: "Could not read package.json",
        description: "Bundle and dependency size metrics were skipped.",
        module: "Performance"
      })
    );
    return out;
  }

  const depCount = Object.keys(pkg.dependencies ?? {}).length;
  out.push(
    issue({
      severity: "info",
      title: `NPM production dependencies: ${depCount}`,
      description: "Large dependency sets increase install surface and can affect cold start. Review for unused packages periodically.",
      module: "Performance"
    })
  );

  const appFiles = await walkSourceFiles(path.join(cwd, "src"), (p) => isPageOrComponent(p), { maxFileBytes: 1_200_000 });
  const lineCounts: { rel: string; lines: number }[] = [];
  for (const f of appFiles) {
    let content: string;
    try {
      content = await readFile(f, "utf8");
    } catch {
      continue;
    }
    const lines = content.split(/\r?\n/).length;
    if (lines > 450) {
      lineCounts.push({ rel: normalizeProjectPath(cwd, f), lines });
    }
  }
  lineCounts.sort((a, b) => b.lines - a.lines);
  for (const { rel, lines } of lineCounts.slice(0, 5)) {
    out.push(
      issue({
        severity: "low",
        title: "Large page/component file",
        description: `~${lines} lines — may slow compile and be harder to optimize. Consider splitting or lazy-loading subviews.`,
        module: "Performance",
        affectedPath: rel
      })
    );
  }

  const hasNext = await readdir(cwd)
    .then((n) => n.some((f) => f === "next.config.mjs" || f === "next.config.js" || f === "next.config.ts"))
    .catch(() => false);
  if (!hasNext) {
    out.push(
      issue({ severity: "low", title: "next.config not found at project root", description: "Cannot inspect Next build settings.", module: "Performance" })
    );
  }

  return out;
}
