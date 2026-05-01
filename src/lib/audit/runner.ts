import path from "path";
import type { AuditModuleId, AuditRunMetrics, AuditRunResult, AuditIssue } from "@/lib/audit/types";
import { AUDIT_MODULE_IDS, summarizeIssues } from "@/lib/audit/types";
import { runSecurityAudit } from "@/lib/audit/modules/security";
import { runApiRouteAudit } from "@/lib/audit/modules/api-routes";
import { runDatabaseAudit } from "@/lib/audit/modules/database";
import { runFunctionalAudit } from "@/lib/audit/modules/functional";
import { runPerformanceAudit } from "@/lib/audit/modules/performance";
import { runUxAudit } from "@/lib/audit/modules/ux";
import { runConsistencyAudit } from "@/lib/audit/modules/consistency";
import { randomUUID } from "crypto";

const PROJECT = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "FTPR Lions Academy web app";

function normalizeModules(mods: AuditModuleId[] | undefined): AuditModuleId[] {
  if (!mods?.length || mods.includes("all")) {
    return [...AUDIT_MODULE_IDS];
  }
  const set = new Set<AuditModuleId>();
  for (const m of mods) {
    if (m === "all") {
      for (const x of AUDIT_MODULE_IDS) set.add(x);
    } else {
      set.add(m);
    }
  }
  return Array.from(set);
}

export async function runTechnicalAudit(modules: AuditModuleId[] | undefined, cwd: string = process.cwd()): Promise<AuditRunResult> {
  const id = randomUUID();
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const toRun = normalizeModules(modules);
  const issues: AuditIssue[] = [];
  const metrics: AuditRunMetrics = { modulesRequested: toRun.length };

  try {
    for (const m of toRun) {
      const tMod = Date.now();
      if (m === "functional") {
        issues.push(...(await runFunctionalAudit(cwd)));
      } else if (m === "api") {
        issues.push(...(await runApiRouteAudit(cwd)));
      } else if (m === "database") {
        issues.push(...(await runDatabaseAudit()));
      } else if (m === "security") {
        issues.push(...(await runSecurityAudit(cwd)));
      } else if (m === "performance") {
        issues.push(...(await runPerformanceAudit(cwd)));
      } else if (m === "ux") {
        issues.push(...(await runUxAudit(cwd)));
      } else if (m === "consistency") {
        issues.push(...(await runConsistencyAudit(cwd)));
      }
      metrics[`durationMs_${m}`] = Date.now() - tMod;
    }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "Audit run failed";
    return {
      id,
      projectName: PROJECT,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - t0,
      modulesRun: toRun,
      issues: [],
      metrics: { ...metrics, error: errMsg },
      summary: summarizeIssues([]),
      pdfUrl: null,
      error: errMsg
    };
  }

  metrics.scannedFrom = path.resolve(cwd);
  metrics.issuesCount = issues.length;
  return {
    id,
    projectName: PROJECT,
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - t0,
    modulesRun: toRun,
    issues,
    metrics,
    summary: summarizeIssues(issues),
    pdfUrl: null
  };
}
