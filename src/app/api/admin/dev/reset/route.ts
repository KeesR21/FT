import { NextResponse } from "next/server";
import { z } from "zod";
import { clearCombinedInvoiceLogs } from "@/lib/combined-invoice-log-store";
import { db } from "@/lib/db";
import { clearInvoiceLogs } from "@/lib/invoice-log-store";
import { resetMockDb } from "@/lib/mock-db";
import { requireAdmin } from "@/lib/require-admin";
import { revalidateAdminViews } from "@/lib/revalidate-admin";
import { jsonMessage } from "@/lib/utils";

const schema = z.object({
  confirm: z.literal("WIPE_ALL_PLAYERS"),
  /** Optional — when true the demo dataset is restored after the wipe. Defaults to false. */
  reseedDemo: z.boolean().optional()
});

/**
 * Destructive admin tool: clears every player, parent, payment, message, and performance
 * entry from the in-memory store, plus the persistent invoice & combined-invoice log
 * files (and generated PDFs). Timetable sessions and CMS/site content are preserved.
 *
 * Requires explicit confirmation in the body to prevent accidental hits:
 *   POST /api/admin/dev/reset  { "confirm": "WIPE_ALL_PLAYERS" }
 */
export async function POST(req: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(jsonMessage("Expected JSON body."), { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      jsonMessage(
        'Reset requires a confirmation token. Send { "confirm": "WIPE_ALL_PLAYERS" } in the request body.'
      ),
      { status: 400 }
    );
  }

  // Snapshot counts BEFORE the wipe so the response can show what was removed.
  const beforePlayers = await db.listPlayers({ includeWithdrawn: true });
  const beforeParents = await db.listParents();
  const beforePayments = await db.listPayments();

  resetMockDb({ reseed: Boolean(parsed.data.reseedDemo), keep: { sessions: true } });

  let removedPdfs = 0;
  try {
    const r = await clearInvoiceLogs();
    removedPdfs = r.removedPdfs;
  } catch {
    /* best effort */
  }
  try {
    await clearCombinedInvoiceLogs();
  } catch {
    /* best effort */
  }

  revalidateAdminViews();

  return NextResponse.json({
    message: parsed.data.reseedDemo
      ? "Cleared all players/parents/payments and restored the demo dataset."
      : "Cleared all players, parents, payments, messages, performance entries, and invoice logs. Timetable, CMS, and pricing were preserved.",
    cleared: {
      players: beforePlayers.length,
      parents: beforeParents.length,
      payments: beforePayments.length,
      invoicePdfs: removedPdfs
    }
  });
}
