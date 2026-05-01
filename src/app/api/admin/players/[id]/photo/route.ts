import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { revalidateAdminViews } from "@/lib/revalidate-admin";
import { revalidatePublicSite } from "@/lib/revalidate-public";
import { jsonMessage } from "@/lib/utils";

const MAX_BYTES = 2_500_000;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  if (!(await db.getPlayer(id))) {
    return NextResponse.json(jsonMessage("Player not found"), { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(jsonMessage("Expected multipart form"), { status: 400 });
  }
  const file = formData.get("photo");
  if (!file || typeof file === "string") {
    return NextResponse.json(jsonMessage('Missing file field "photo"'), { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(jsonMessage("Use JPEG, PNG, or WebP"), { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(jsonMessage("Image must be under 2.5 MB"), { status: 400 });
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const rel = `/uploads/players/${id}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", "players");
  await mkdir(dir, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, `${id}.${ext}`), buf);

  await db.updatePlayer(id, { profilePhotoUrl: rel });
  revalidatePublicSite();
  revalidateAdminViews();

  return NextResponse.json({ profilePhotoUrl: rel });
}
