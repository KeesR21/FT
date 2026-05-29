import { mkdir, readFile, stat, writeFile } from "fs/promises";
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

// ---------------------------------------------------------------------------
// In-process cache — avoids hitting the filesystem on every API request.
// The cache is invalidated on every write so reads are always consistent.
// TTL is a safety net for multi-instance deployments or stale mtime reads.
// ---------------------------------------------------------------------------
const CACHE_TTL_MS = 5_000; // 5 seconds max staleness
type CacheEntry = { shape: FileShape; ts: number; mtime: number };
let _cache: CacheEntry | null = null;

function cacheGet(): FileShape | null {
  if (!_cache) return null;
  if (Date.now() - _cache.ts > CACHE_TTL_MS) return null;
  return _cache.shape;
}

function cacheSet(shape: FileShape, mtime: number): void {
  _cache = { shape, ts: Date.now(), mtime };
}

function cacheInvalidate(): void {
  _cache = null;
}

// ---------------------------------------------------------------------------
// Activity-touch debouncing — writing to disk on every authenticated request
// was the main source of slowness and OneDrive lock contention. We now write
// at most once per TOUCH_DEBOUNCE_MS when the session is active.
// ---------------------------------------------------------------------------
const TOUCH_DEBOUNCE_MS = 60_000; // 1 minute
let _lastTouchMs = 0;

// ---------------------------------------------------------------------------

async function ensureRead(): Promise<FileShape> {
  // 1. Serve from in-process cache when fresh.
  const cached = cacheGet();
  if (cached) return cached;

  await mkdir(DIR, { recursive: true });
  try {
    // Check mtime first — only read if file changed since last cache fill.
    let mtime = 0;
    try {
      const s = await stat(FILE);
      mtime = s.mtimeMs;
      if (_cache && _cache.mtime === mtime) {
        // File unchanged — refresh TTL and return.
        cacheSet(_cache.shape, mtime);
        return _cache.shape;
      }
    } catch { /* file may not exist yet */ }

    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as FileShape;
    const shape =
      parsed && typeof parsed === "object" && parsed.credentials && typeof parsed.credentials === "object"
        ? parsed
        : emptyShape();
    cacheSet(shape, mtime);
    return shape;
  } catch (err) {
    // Only initialise the file when it genuinely does not exist yet.
    // Do NOT overwrite on transient I/O errors (e.g. file locked by OneDrive
    // or another process) — that would silently wipe a valid session token.
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      const empty = emptyShape();
      try {
        await writeFile(FILE, JSON.stringify(empty, null, 2), "utf8");
        cacheSet(empty, 0);
      } catch { /* ignore — directory may not be ready yet */ }
    }
    return emptyShape();
  }
}

async function writeShape(shape: FileShape): Promise<void> {
  cacheInvalidate(); // Invalidate before write so next read is fresh.
  await mkdir(DIR, { recursive: true });
  await writeFile(FILE, JSON.stringify(shape, null, 2), "utf8");
}

export function getConfiguredAdminEmailLower(): string {
  return (process.env.ADMIN_EMAIL ?? "admin@ftprlions.com").trim().toLowerCase();
}

function legacyPlaintextPassword(): string {
  return process.env.ADMIN_PASSWORD ?? "admin123";
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
  _lastTouchMs = Date.now(); // Reset debounce after fresh credential init.
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
  _lastTouchMs = 0;
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
  _lastTouchMs = Date.now();
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
  _lastTouchMs = 0;
}

/**
 * Update session last-activity timestamp. Debounced to at most one disk write
 * per {@link TOUCH_DEBOUNCE_MS} to avoid hammering the filesystem on every
 * authenticated API request.
 */
export async function touchAdminSessionActivity(): Promise<void> {
  const now = Date.now();
  if (now - _lastTouchMs < TOUCH_DEBOUNCE_MS) return; // Debounce: skip write.

  const cur = await getAdminCredentials();
  if (!cur?.sessionToken) return;
  _lastTouchMs = now;
  const iso = new Date(now).toISOString();
  await persistCredentials({ ...cur, sessionLastActivityAt: iso, updatedAt: iso });
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
