import { headers } from "next/headers";
import { Role } from "@/lib/types";

const ROLE_HEADER = "x-user-role";

export async function getCurrentRole(): Promise<Role> {
  const hdrs = await headers();
  const value = hdrs.get(ROLE_HEADER) as Role | null;
  if (!value) return "editor";
  return value;
}

export function canManageUsers(role: Role) {
  return role === "super_admin";
}

export function canApproveRegistrations(role: Role) {
  return role === "super_admin" || role === "editor";
}

export function canUploadPhotos(role: Role) {
  return role === "super_admin" || role === "photographer";
}
