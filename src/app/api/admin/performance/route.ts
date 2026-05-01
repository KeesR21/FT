import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { revalidateAdminViews } from "@/lib/revalidate-admin";
import { requireAdmin } from "@/lib/require-admin";
import { jsonMessage } from "@/lib/utils";

const schema = z.object({
  playerId: z.string().min(1),
  notes: z.string().min(2),
  focusArea: z.string().optional(),
  date: z.string().optional()
});

export async function POST(req: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(jsonMessage("Invalid performance entry", { issues: parsed.error.flatten() }), { status: 400 });
  }
  if (!(await db.getPlayer(parsed.data.playerId))) {
    return NextResponse.json(jsonMessage("Player not found"), { status: 404 });
  }
  const row = await db.addPerformance({
    playerId: parsed.data.playerId,
    notes: parsed.data.notes,
    focusArea: parsed.data.focusArea,
    date: parsed.data.date ?? new Date().toISOString()
  });
  revalidateAdminViews();
  return NextResponse.json({ entry: row }, { status: 201 });
}
