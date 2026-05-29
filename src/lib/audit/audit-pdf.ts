import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { AuditIssue, AuditRunResult, AuditSeverity } from "@/lib/audit/types";

const SEVERITY_ORDER: AuditSeverity[] = ["critical", "high", "medium", "low", "info"];

function sevColor(s: AuditSeverity) {
  switch (s) {
    case "critical":
      return rgb(0.65, 0.1, 0.12);
    case "high":
      return rgb(0.8, 0.35, 0.1);
    case "medium":
      return rgb(0.75, 0.5, 0.05);
    case "low":
      return rgb(0.2, 0.35, 0.6);
    default:
      return rgb(0.35, 0.4, 0.45);
  }
}

function wrapLine(text: string, maxLen: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (!w) continue;
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxLen && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

export async function generateAuditReportPdf(result: AuditRunResult): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageW = 595.28;
  const pageH = 841.89;
  const margin = 50;
  const maxW = 92;

  let page = pdf.addPage([pageW, pageH]);
  let y = pageH - margin;

  const draw = (t: string, size = 10, f = font, c = rgb(0.1, 0.1, 0.1)) => {
    for (const part of wrapLine(t, maxW)) {
      if (y < margin + 40) {
        page = pdf.addPage([pageW, pageH]);
        y = pageH - margin;
      }
      page.drawText(part, { x: margin, y, size, font: f, color: c });
      y -= size + 3;
    }
  };

  page.drawText("Technical Audit Report", { x: margin, y, size: 22, font: bold, color: rgb(0.08, 0.12, 0.28) });
  y -= 32;
  draw(result.projectName, 12, bold);
  y -= 4;
  draw(`Generated: ${result.finishedAt.slice(0, 19).replace("T", " ")}  ·  Run ID: ${result.id.slice(0, 8)}…`, 9, font, rgb(0.35, 0.35, 0.4));
  y -= 8;
  draw(
    `Duration: ${(result.durationMs / 1000).toFixed(1)}s  ·  Modules: ${result.modulesRun.join(", ")}${
      result.error ? `  ·  Error: ${result.error}` : ""
    }`,
    9
  );
  y -= 14;

  if (y < margin + 100) {
    page = pdf.addPage([pageW, pageH]);
    y = pageH - margin;
  }
  page.drawText("Executive summary", { x: margin, y, size: 14, font: bold, color: rgb(0.1, 0.1, 0.2) });
  y -= 20;
  draw(`Total issues / findings: ${result.summary.total}`, 11, bold);
  for (const sev of SEVERITY_ORDER) {
    const c = result.summary.bySeverity[sev];
    if (c > 0) draw(`  ${sev}: ${c}`, 10, font, sevColor(sev));
  }
  y -= 8;

  const metLines = Object.entries(result.metrics)
    .filter(([k]) => k !== "error")
    .map(([k, v]) => `  ${k}: ${v}`);
  if (metLines.length) {
    page.drawText("Metrics & environment", { x: margin, y, size: 12, font: bold });
    y -= 16;
    for (const ml of metLines) {
      draw(ml, 9, font, rgb(0.2, 0.22, 0.25));
    }
  }

  page.drawText("Detailed findings", { x: margin, y, size: 14, font: bold, color: rgb(0.1, 0.1, 0.2) });
  y -= 18;

  const byGroup = new Map<string, AuditIssue[]>();
  for (const i of result.issues) {
    const g = i.module || "General";
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(i);
  }
  const groups = [...byGroup.keys()].sort();

  for (const g of groups) {
    for (const issue of byGroup.get(g)!) {
      if (y < margin + 120) {
        page = pdf.addPage([pageW, pageH]);
        y = pageH - margin;
      }
      page.drawText(issue.severity.toUpperCase(), { x: margin, y, size: 7, font: bold, color: sevColor(issue.severity) });
      page.drawText(`[${g}]  ${issue.title}`, { x: margin + 64, y, size: 11, font: bold, color: rgb(0.08, 0.1, 0.15) });
      y -= 16;
      for (const part of wrapLine(issue.description, maxW - 2)) {
        if (y < margin + 24) {
          page = pdf.addPage([pageW, pageH]);
          y = pageH - margin;
        }
        page.drawText(part, { x: margin + 6, y, size: 9, font, color: rgb(0.15, 0.15, 0.16) });
        y -= 11;
      }
      if (issue.affectedPath) {
        page.drawText(`File: ${issue.affectedPath}`, { x: margin + 6, y, size: 8, font, color: rgb(0.25, 0.3, 0.45) });
        y -= 10;
      }
      if (issue.suggestedFix) {
        for (const part of wrapLine(`Fix: ${issue.suggestedFix}`, maxW - 2)) {
          if (y < margin + 24) {
            page = pdf.addPage([pageW, pageH]);
            y = pageH - margin;
          }
          page.drawText(part, { x: margin + 6, y, size: 8, font, color: rgb(0.1, 0.35, 0.2) });
          y -= 10;
        }
      }
      y -= 8;
    }
  }

  if (y < margin + 30) {
    page = pdf.addPage([pageW, pageH]);
    y = pageH - margin;
  }
  page.drawText("Recommendations", { x: margin, y, size: 12, font: bold });
  y -= 14;
  for (const t of [
    "Treat Critical/High items before release; schedule Medium in the next sprint.",
    "Re-run this audit after major finance or security changes; add E2E tests for payment and invoice flows.",
    "Complement with npm audit, Playwright e2e, and hosted DB backups for production readiness."
  ]) {
    for (const part of wrapLine(t, maxW)) {
      if (y < margin + 20) {
        page = pdf.addPage([pageW, pageH]);
        y = pageH - margin;
      }
      page.drawText(`• ${part}`, { x: margin, y, size: 9, font, color: rgb(0.2, 0.2, 0.22) });
      y -= 12;
    }
  }

  return await pdf.save();
}
