import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { revalidateAdminViews } from "@/lib/revalidate-admin";
import { revalidatePublicSite } from "@/lib/revalidate-public";
import { jsonMessage } from "@/lib/utils";

const MAX_BYTES = 4_000_000;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(req: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(jsonMessage("Expected multipart form"), { status: 400 });
  }
  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json(jsonMessage('Missing file field "file"'), { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(jsonMessage("Use JPEG, PNG, WebP, or GIF"), { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(jsonMessage("Image must be under 4 MB"), { status: 400 });
  }

  const ext =
    file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "image/gif" ? "gif" : "jpg";
  const name = `${randomUUID()}.${ext}`;
  const rel = `/uploads/cms/${name}`;
  const dir = path.join(process.cwd(), "public", "uploads", "cms");
  await mkdir(dir, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, name), buf);
  revalidatePublicSite();
  revalidateAdminViews();
  return NextResponse.json({ url: rel });
}
