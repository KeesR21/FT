import { getAdminCredentials, getConfiguredAdminEmailLower } from "@/lib/admin-credential-store";

/** Human-readable label for the currently authenticated admin (server-side only). */
export async function getAuthenticatedAdminLabel(): Promise<string> {
  const c = await getAdminCredentials();
  const fallback = process.env.ADMIN_EMAIL?.trim() || getConfiguredAdminEmailLower();
  return (c?.email ?? fallback).trim() || "admin";
}

/** Stable id (email lower) + display label for audit rows. */
export async function getAuthenticatedAdminActor(): Promise<{ id: string; label: string }> {
  const c = await getAdminCredentials();
  const fallback = process.env.ADMIN_EMAIL?.trim() || getConfiguredAdminEmailLower();
  const label = (c?.email ?? fallback).trim() || "admin";
  const id = label.toLowerCase();
  return { id, label };
}
