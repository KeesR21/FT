import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, isValidSessionToken } from "@/lib/auth";
import { jsonMessage } from "@/lib/utils";

export async function requireAdmin(): Promise<NextResponse | null> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!isValidSessionToken(token)) {
    return NextResponse.json(jsonMessage("Unauthorized"), { status: 401 });
  }
  return null;
}
