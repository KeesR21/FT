import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { StoredAuditRun, AuditRunResult } from "@/lib/audit/types";

const AUDIT_DIR = path.join(process.cwd(), "public", "uploads", "audits");
const HISTORY = path.join(AUDIT_DIR, "audit-history.json");
const MAX_STORED = 20;

type HistoryFile = { runs: StoredAuditRun[] };

async function ensureDir() {
  await mkdir(AUDIT_DIR, { recursive: true });
}

async function readHistory(): Promise<HistoryFile> {
  try {
    const raw = await readFile(HISTORY, "utf8");
    const p = JSON.parse(raw) as HistoryFile;
    if (!Array.isArray(p.runs)) return { runs: [] };
    return p;
  } catch {
    return { runs: [] };
  }
}

async function writeHistory(f: HistoryFile) {
  await ensureDir();
  f.runs = f.runs.slice(0, MAX_STORED);
  await writeFile(HISTORY, JSON.stringify(f, null, 2), "utf8");
}

function toStored(result: AuditRunResult, pdfRelativePath: string | null): StoredAuditRun {
  return {
    id: result.id,
    projectName: result.projectName,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt,
    durationMs: result.durationMs,
    modulesRun: result.modulesRun,
    issues: result.issues,
    metrics: result.metrics,
    summary: result.summary,
    pdfRelativePath: pdfRelativePath,
    error: result.error
  };
}

export async function saveAuditRun(result: AuditRunResult, pdfRelativePath: string | null): Promise<StoredAuditRun> {
  const h = await readHistory();
  const entry = toStored(result, pdfRelativePath);
  h.runs.unshift(entry);
  await writeHistory(h);
  return entry;
}

export async function listAuditHistory(): Promise<Pick<StoredAuditRun, "id" | "finishedAt" | "summary" | "modulesRun" | "durationMs" | "error" | "pdfRelativePath">[]> {
  const h = await readHistory();
  return h.runs.map((r) => ({
    id: r.id,
    finishedAt: r.finishedAt,
    summary: r.summary,
    modulesRun: r.modulesRun,
    durationMs: r.durationMs,
    error: r.error,
    pdfRelativePath: r.pdfRelativePath
  }));
}

export async function getAuditRun(id: string): Promise<StoredAuditRun | null> {
  const h = await readHistory();
  return h.runs.find((r) => r.id === id) ?? null;
}

export function auditPdfFileName(auditId: string): string {
  return `audit-${auditId}.pdf`;
}
