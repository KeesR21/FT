import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { generateAuditReportPdf } from "@/lib/audit/audit-pdf";
import { getAuditRun, listAuditHistory, saveAuditRun, auditPdfFileName } from "@/lib/audit/audit-log-store";
import { runTechnicalAudit } from "@/lib/audit/runner";
import { AUDIT_MODULE_IDS, type AuditModuleId } from "@/lib/audit/types";
import { requireAdmin } from "@/lib/require-admin";

export const maxDuration = 120;

const moduleIdSchema = z.enum([
  "functional",
  "api",
  "database",
  "security",
  "performance",
  "ux",
  "consistency",
  "all"
] as [AuditModuleId, ...AuditModuleId[]]);

const postSchema = z.object({
  modules: z.array(moduleIdSchema).optional()
});

function normalizePostedModules(mods: AuditModuleId[] | undefined): AuditModuleId[] | undefined {
  if (!mods?.length) return undefined;
  if (mods.includes("all")) return ["all"] as unknown as AuditModuleId[];
  const ok = new Set<AuditModuleId>(AUDIT_MODULE_IDS as unknown as AuditModuleId[]);
  return mods.filter((m): m is AuditModuleId => m === "all" || ok.has(m));
}

export async function GET(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const id = new URL(request.url).searchParams.get("id");
  if (id) {
    const run = await getAuditRun(id);
    if (!run) {
      return NextResponse.json({ message: "Audit run not found" }, { status: 404 });
    }
    return NextResponse.json({ run });
  }
  const history = await listAuditHistory();
  return NextResponse.json({ history });
}

export async function POST(req: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Expected JSON" }, { status: 400 });
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload", issues: parsed.error.flatten() }, { status: 400 });
  }
  const modules = normalizePostedModules(parsed.data.modules);

  const result = await runTechnicalAudit(modules);
  if (result.error) {
    const stored = await saveAuditRun({ ...result, issues: result.issues }, null);
    return NextResponse.json({ result: { ...result, pdfUrl: null, stored: true, storedId: stored.id } }, { status: 200 });
  }

  const bytes = await generateAuditReportPdf(result);
  const dir = path.join(process.cwd(), "public", "uploads", "audits");
  await mkdir(dir, { recursive: true });
  const name = auditPdfFileName(result.id);
  const abs = path.join(dir, name);
  await writeFile(abs, Buffer.from(bytes));
  const pdfUrl = `/uploads/audits/${name}`;

  const withUrl = { ...result, pdfUrl };
  await saveAuditRun(withUrl, pdfUrl);

  return NextResponse.json({ result: { ...withUrl, stored: true, storedId: result.id } });
}
