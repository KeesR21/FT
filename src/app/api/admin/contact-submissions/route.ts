import { NextResponse } from "next/server";
import { listContactSubmissions } from "@/lib/contact-submissions";
import { requireAdmin } from "@/lib/require-admin";

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const submissions = await listContactSubmissions();
  return NextResponse.json({ submissions });
}
