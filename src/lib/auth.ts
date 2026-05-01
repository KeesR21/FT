import { createHash } from "crypto";

export const ADMIN_COOKIE = "academy_admin_session";

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function getSessionToken(email: string) {
  const secret = process.env.JWT_SECRET ?? "dev-secret";
  return hash(`${email}:${secret}`);
}

export function isValidAdminCredentials(email: string, password: string) {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@ftprlions.com";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin123";
  return email === adminEmail && password === adminPassword;
}

/** Validates cookie value from admin login (single configured admin email). */
export function isValidSessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@ftprlions.com";
  return token === getSessionToken(adminEmail);
}
