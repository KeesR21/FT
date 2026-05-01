export type AuditSeverity = "critical" | "high" | "medium" | "low" | "info";

export const AUDIT_MODULE_IDS = [
  "functional",
  "api",
  "database",
  "security",
  "performance",
  "ux",
  "consistency"
] as const;

export type AuditModuleId = (typeof AUDIT_MODULE_IDS)[number] | "all";

export type AuditIssue = {
  id: string;
  title: string;
  description: string;
  severity: AuditSeverity;
  /** e.g. Finance, API, Security, UI/UX, Database */
  module: string;
  affectedPath?: string;
  suggestedFix?: string;
};

export type AuditRunMetrics = Record<string, string | number | boolean>;

export type AuditSummary = {
  total: number;
  bySeverity: Record<AuditSeverity, number>;
};

export type AuditRunResult = {
  id: string;
  projectName: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  modulesRun: AuditModuleId[];
  issues: AuditIssue[];
  metrics: AuditRunMetrics;
  summary: AuditSummary;
  pdfUrl: string | null;
  error?: string;
};

export type StoredAuditRun = Omit<AuditRunResult, "pdfUrl"> & {
  pdfRelativePath: string | null;
};

export function emptySummary(): AuditSummary {
  return {
    total: 0,
    bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
  };
}

export function summarizeIssues(issues: AuditIssue[]): AuditSummary {
  const s = emptySummary();
  s.total = issues.length;
  for (const i of issues) {
    s.bySeverity[i.severity] += 1;
  }
  return s;
}
