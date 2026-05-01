import { NextResponse } from "next/server";
import { z } from "zod";
import { isAgeGroup } from "@/lib/age-groups";
import {
  addRegistrationFeeVersion,
  loadPricing,
  setDefaultMonthlyFee,
  setGroupFee
} from "@/lib/pricing-store";
import { requireAdmin } from "@/lib/require-admin";
import { revalidateAdminViews } from "@/lib/revalidate-admin";

function adminLabel(): string {
  return process.env.ADMIN_EMAIL ?? "admin@ftprlions.com";
}

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const file = await loadPricing();
  return NextResponse.json({ pricing: file });
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("set-group-fee"),
    group: z.string().min(1),
    amount: z.coerce.number().positive(),
    currency: z.string().min(2).max(8).optional()
  }),
  z.object({
    action: z.literal("set-default-fee"),
    amount: z.coerce.number().positive(),
    currency: z.string().min(2).max(8).optional()
  }),
  z.object({
    action: z.literal("add-registration-fee"),
    amount: z.coerce.number().positive(),
    currency: z.string().min(2).max(8).optional(),
    /** ISO date or yyyy-mm-dd; defaults to "now" server-side. */
    effectiveFrom: z.string().min(8).optional(),
    note: z.string().max(280).optional()
  })
]);

export async function POST(req: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const body = await req.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid pricing action payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    if (parsed.data.action === "set-group-fee") {
      if (!isAgeGroup(parsed.data.group)) {
        return NextResponse.json({ message: "Unknown age group." }, { status: 400 });
      }
      const file = await setGroupFee({
        group: parsed.data.group,
        amount: parsed.data.amount,
        currency: parsed.data.currency ?? "RWF",
        updatedBy: adminLabel()
      });
      revalidateAdminViews();
      return NextResponse.json({ message: `Updated monthly fee for ${parsed.data.group}.`, pricing: file });
    }

    if (parsed.data.action === "set-default-fee") {
      const file = await setDefaultMonthlyFee({
        amount: parsed.data.amount,
        currency: parsed.data.currency ?? "RWF",
        updatedBy: adminLabel()
      });
      revalidateAdminViews();
      return NextResponse.json({ message: "Default monthly fee updated.", pricing: file });
    }

    const effectiveFrom = (parsed.data.effectiveFrom ?? new Date().toISOString()).trim();
    const file = await addRegistrationFeeVersion({
      amount: parsed.data.amount,
      currency: parsed.data.currency ?? "RWF",
      effectiveFrom,
      createdBy: adminLabel(),
      note: parsed.data.note
    });
    revalidateAdminViews();
    return NextResponse.json({
      message: "New registration fee version added. It will only apply to registrations on/after the effective date.",
      pricing: file
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Pricing update failed.";
    return NextResponse.json({ message: msg }, { status: 400 });
  }
}
