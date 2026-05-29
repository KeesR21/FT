import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
/** Single configured academy admin credentials (persisted hashed password). */
export type AdminCredentialsRecord = {
  emailLower: string;
  email: string;
  passwordHash: string;
  /** Opaque rotating session secret; invalidated on logout or password change. */
  sessionToken: string;
  updatedAt: string;
  /** Last successful auth activity (page load or API). Used for idle timeout. */
  sessionLastActivityAt?: string;
};

const DIR = path.join(process.cwd(), "public", "uploads", "admin-auth");
const FILE = path.join(DIR, "credentials.json");

type FileShape = {
  credentials: AdminCredentialsRecord | null;
};

function emptyShape(): FileShape {
  return { credentials: null };
}

export function getConfiguredAdminEmailLower(): string {
  return (process.env.ADMIN_EMAIL ?? "admin@ftprlions.com").trim().toLowerCase();
}

function legacyPlaintextPassword(): string {
  return process.env.ADMIN_PASSWORD ?? "admin123";
}

async function ensureRead(): Promise<FileShape> {
  await mkdir(DIR, { recursive: true });
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as FileShape;
    if (!parsed || typeof parsed !== "object") return emptyShape();
    if (parsed.credentials && typeof parsed.credentials === "object") return parsed;
    return emptyShape();
  } catch (err) {
    // Only initialise the file when it genuinely does not exist yet.
    // Do NOT overwrite on transient I/O errors (e.g. file locked by OneDrive
    // or another process) — that would silently wipe a valid session token.
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      try {
        await writeFile(FILE, JSON.stringify(emptyShape(), null, 2), "utf8");
      } catch { /* ignore — directory may not be ready yet */ }
    }
    return emptyShape();
  }
}

async function writeShape(shape: FileShape): Promise<void> {
  await mkdir(DIR, { recursive: true });
  await writeFile(FILE, JSON.stringify(shape, null, 2), "utf8");
}

export async function getAdminCredentials(): Promise<AdminCredentialsRecord | null> {
  const shape = await ensureRead();
  return shape.credentials;
}

async function persistCredentials(record: AdminCredentialsRecord): Promise<void> {
  await writeShape({ credentials: record });
}

function newSessionToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Save initial credentials (hashed password) and session after first legacy login success.
 */
export async function initializeAdminCredentials(
  emailNormalized: string,
  passwordHash: string
): Promise<AdminCredentialsRecord> {
  const now = new Date().toISOString();
  const rec: AdminCredentialsRecord = {
    emailLower: emailNormalized.trim().toLowerCase(),
    email: emailNormalized.trim(),
    passwordHash,
    sessionToken: newSessionToken(),
    updatedAt: now,
    sessionLastActivityAt: now
  };
  await persistCredentials(rec);
  return rec;
}

/** Replace password hash and clear rotating session — caller must invalidate the admin cookie. */
export async function setAdminPasswordHashClearingSession(passwordHash: string): Promise<void> {
  const lower = getConfiguredAdminEmailLower();
  const cur = await getAdminCredentials();
  const displayEnv = process.env.ADMIN_EMAIL?.trim();
  const email =
    cur?.email ?? (displayEnv && displayEnv.includes("@") ? displayEnv : lower);
  const record: AdminCredentialsRecord = {
    emailLower: lower,
    email,
    passwordHash,
    sessionToken: "",
    updatedAt: new Date().toISOString(),
    sessionLastActivityAt: undefined
  };
  await persistCredentials(record);
}

export async function setAdminSessionToken(token: string): Promise<void> {
  const cur = await getAdminCredentials();
  if (!cur) return;
  await persistCredentials({ ...cur, sessionToken: token, updatedAt: new Date().toISOString() });
}

export async function rotateAdminSessionToken(): Promise<AdminCredentialsRecord | null> {
  const cur = await getAdminCredentials();
  if (!cur) return null;
  const tok = newSessionToken();
  const now = new Date().toISOString();
  const next = { ...cur, sessionToken: tok, updatedAt: now, sessionLastActivityAt: now };
  await persistCredentials(next);
  return next;
}

export async function clearAdminSession(): Promise<void> {
  const cur = await getAdminCredentials();
  if (!cur) return;
  await persistCredentials({
    ...cur,
    sessionToken: "",
    updatedAt: new Date().toISOString(),
    sessionLastActivityAt: undefined
  });
}

export async function touchAdminSessionActivity(): Promise<void> {
  const cur = await getAdminCredentials();
  if (!cur?.sessionToken) return;
  const now = new Date().toISOString();
  await persistCredentials({ ...cur, sessionLastActivityAt: now, updatedAt: now });
}

/** @returns true when idle past configured window (default 30 minutes). Legacy sessions without timestamp are not expired. */
export async function isAdminSessionIdleExpired(): Promise<boolean> {
  const cur = await getAdminCredentials();
  if (!cur?.sessionLastActivityAt) return false;
  const mins = Number(process.env.ADMIN_SESSION_IDLE_MINUTES);
  const windowMs = (Number.isFinite(mins) && mins > 0 ? mins : 30) * 60 * 1000;
  return Date.now() - new Date(cur.sessionLastActivityAt).getTime() > windowMs;
}

export function acceptsLegacyPlaintext(password: string): boolean {
  return legacyPlaintextPassword() === password;
}

export type VerifiedAdminCredentialContext = {
  emailLower: string;
  /** Persisted credentials, or legacy-only login (until first migration persistence). */
  mode: "persisted" | "legacy_env";
};

/**
 * Validates admin email/password. When no file exists yet, accepts env plaintext once.
 */
export async function verifyAdminLogin(
  email: string,
  password: string
): Promise<VerifiedAdminCredentialContext | null> {
  const emailLower = email.trim().toLowerCase();
  const expected = getConfiguredAdminEmailLower();
  if (!emailLower || emailLower !== expected) return null;

  const persisted = await getAdminCredentials();
  if (persisted) {
    const { verifyPassword } = await import("@/lib/password-hash");
    const ok = await verifyPassword(password, persisted.passwordHash);
    if (!ok) return null;
    return { emailLower, mode: "persisted" };
  }

  if (acceptsLegacyPlaintext(password)) {
    return { emailLower, mode: "legacy_env" };
  }
  return null;
}
