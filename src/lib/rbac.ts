import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidSessionToken } from "@/lib/auth";
import type { Role } from "@/lib/types";

/**
 * Role derived only from a valid admin session cookie — never from client-controlled headers.
 * Returns null when the caller is not an authenticated admin.
 */
export async function getCurrentRole(): Promise<Role | null> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (await isValidSessionToken(token)) {
    return "super_admin";
  }
  return null;
}

export function canManageUsers(role: Role | null) {
  return role === "super_admin";
}

export function canApproveRegistrations(role: Role | null) {
  return role === "super_admin" || role === "editor";
}

export function canUploadPhotos(role: Role | null) {
  return role === "super_admin" || role === "photographer";
}
