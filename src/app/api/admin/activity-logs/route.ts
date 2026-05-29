import { NextResponse } from "next/server";
import { z } from "zod";
import { queryActivityLogs } from "@/lib/activity-log-store";
import { requireAdmin } from "@/lib/require-admin";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  action: z.string().optional(),
  actorId: z.string().optional(),
  resourceType: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  q: z.string().optional()
});

export async function GET(req: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const url = new URL(req.url);
  const raw = Object.fromEntries(url.searchParams.entries());
  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid query", issues: parsed.error.flatten() }, { status: 400 });
  }

  const result = await queryActivityLogs(parsed.data);
  return NextResponse.json(result);
}
