import { createHash, timingSafeEqual } from "crypto";
import { getAdminCredentials, getConfiguredAdminEmailLower } from "@/lib/admin-credential-store";

export const ADMIN_COOKIE = "academy_admin_session";

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/** @deprecated Prefer rotating opaque session tokens; kept for legacy cookie acceptance. */
export function getSessionToken(email: string) {
  const secret = process.env.JWT_SECRET ?? "dev-secret";
  return hash(`${email.trim().toLowerCase()}:${secret}`);
}

/** @deprecated plaintext env credentials — superseded by persisted scrypt hash. */
export function isValidAdminCredentials(email: string, password: string) {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@ftprlions.com";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin123";
  return email === adminEmail && password === adminPassword;
}

function safeEqualHex(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}

/**
 * Validates admin session cookie: rotating opaque token when persisted credentials exist,
 * or legacy deterministic token only before the first migration (no credentials file).
 */
export async function isValidSessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const cred = await getAdminCredentials();
  if (cred) {
    if (!cred.sessionToken || cred.sessionToken.length === 0) return false;
    return safeEqualHex(token, cred.sessionToken);
  }
  const legacyTok = getSessionToken(getConfiguredAdminEmailLower());
  return safeEqualHex(token, legacyTok);
}

export function adminSessionCookieOptions(opts?: { clear?: boolean }) {
  const isSecure = process.env.NODE_ENV === "production";
  if (opts?.clear) {
    return {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax" as const,
      path: "/",
      maxAge: 0
    };
  }
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 30 * 60   // 30 minutes — sliding: refreshed on every API request
  };
}
