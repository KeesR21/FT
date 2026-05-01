import { readFile } from "fs/promises";
import path from "path";
import { walkSourceFiles, normalizeProjectPath } from "@/lib/audit/context";
import { issue } from "@/lib/audit/issue-factory";
import type { AuditIssue } from "@/lib/audit/types";

function shouldScanSource(abs: string): boolean {
  if (!abs.includes(`${path.sep}src${path.sep}`)) return false;
  if (abs.includes(`${path.sep}node_modules${path.sep}`)) return false;
  return abs.endsWith(".ts") || abs.endsWith(".tsx");
}

/**
 * Static security heuristics (not a replacement for SAST/pen tests).
 */
export async function runSecurityAudit(cwd: string): Promise<AuditIssue[]> {
  const out: AuditIssue[] = [];
  const files = await walkSourceFiles(
    path.join(cwd, "src"),
    shouldScanSource,
    { maxFileBytes: 600_000 }
  );

  for (const file of files) {
    const rel = normalizeProjectPath(cwd, file);
    let content: string;
    try {
      content = await readFile(file, "utf8");
    } catch {
      continue;
    }

    if (/\beval\s*\(/.test(content) || /new Function\s*\(/.test(content)) {
      out.push(
        issue({
          severity: "high",
          title: "Dynamic code execution pattern",
          description:
            "Source contains eval() or new Function() which can be unsafe if user-controlled input reaches it.",
          module: "Security",
          affectedPath: rel,
          suggestedFix: "Remove dynamic execution or strictly sandbox and validate all inputs."
        })
      );
    }

    if (content.includes("dangerouslySetInnerHTML")) {
      const hasDompurify = /dompurify|isomorphic-dompurify/i.test(content);
      if (!hasDompurify) {
        out.push(
          issue({
            severity: "medium",
            title: "HTML injection risk (dangerouslySetInnerHTML)",
            description: "Component sets raw HTML without an obvious DOMPurify / sanitizer in the same file.",
            module: "Security",
            affectedPath: rel,
            suggestedFix: "Sanitize HTML with DOMPurify (or avoid raw HTML) before rendering."
          })
        );
      }
    }

  }

  if (out.length === 0) {
    out.push(
      issue({
        severity: "info",
        title: "No high-risk static patterns in scanned files",
        description: "Automated scan did not flag eval/unsafe HTML/SQL-string patterns in readable source files.",
        module: "Security"
      })
    );
  }

  return out;
}
