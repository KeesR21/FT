import { NextResponse } from "next/server";
import { toCsv } from "@/lib/csv";
import { requireAdmin } from "@/lib/require-admin";

const TEMPLATE_HEADERS = [
  "playerName",
  "dateOfBirth",
  "heightCm",
  "weightKg",
  "parentName",
  "phoneNumber",
  "email",
  "address"
];

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const csv = toCsv(TEMPLATE_HEADERS, [
    {
      playerName: "John Doe",
      dateOfBirth: "2015-04-20",
      heightCm: 135,
      weightKg: 32,
      parentName: "Jane Doe",
      phoneNumber: "+250780000000",
      email: "parent@example.com",
      address: "Kigali"
    }
  ]);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="roster-upload-template.csv"'
    }
  });
}
