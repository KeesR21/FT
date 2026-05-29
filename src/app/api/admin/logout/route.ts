import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { clearAdminSession } from "@/lib/admin-credential-store";
import { getAuthenticatedAdminActor } from "@/lib/admin-actor";
import { ADMIN_COOKIE, adminSessionCookieOptions, isValidSessionToken } from "@/lib/auth";
import { recordActivity } from "@/lib/activity-log";

export async function POST(req: Request) {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (await isValidSessionToken(token)) {
    const actor = await getAuthenticatedAdminActor();
    recordActivity(req, {
      actorKind: "admin",
      actorId: actor.id,
      actorLabel: actor.label,
      action: "admin.logout",
      description: "Administrator signed out"
    });
  }

  await clearAdminSession();
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, "", adminSessionCookieOptions({ clear: true }));
  return NextResponse.json({ message: "Logged out" });
}
