import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { revalidateAdminViews } from "@/lib/revalidate-admin";
import { requireAdmin } from "@/lib/require-admin";
import { jsonMessage } from "@/lib/utils";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  const p = await db.withdrawPlayer(id);
  if (!p) return NextResponse.json(jsonMessage("Player not found"), { status: 404 });
  revalidateAdminViews();
  return NextResponse.json({ message: "Player withdrawn", player: p });
}
