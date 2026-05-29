import { mkdir, readFile, stat, writeFile } from "fs/promises";
import path from "path";
import { randomBytes, randomUUID } from "crypto";
import { parentEmailMatchKey } from "@/lib/portal-linked-players";

export type ParentAccount = {
  id: string;
  email: string;
  emailLower: string;
  fullName: string;
  passwordHash?: string;
  /** Set when the account was created via Google sign-in. */
  googleSubject?: string;
  /** Server-issued session token (rotated on login). */
  sessionToken?: string;
  /** Last successful login. */
  lastLoginAt?: string;
  /** Last portal page/API activity — idle timeout (default 7 days). */
  sessionLastActivityAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateAccountInput = {
  email: string;
  fullName: string;
  passwordHash?: string;
  googleSubject?: string;
};

const DIR = path.join(process.cwd(), "public", "uploads", "parent-accounts");
const FILE = path.join(DIR, "accounts.json");

// ---------------------------------------------------------------------------
// In-process cache — avoids reading the full accounts file on every portal
// API request (session check, auth middleware, etc.).
// Invalidated on every write; TTL is a safety net for stale-process scenarios.
// ---------------------------------------------------------------------------
const CACHE_TTL_MS = 5_000;
type CacheEntry = { accounts: ParentAccount[]; ts: number; mtime: number };
let _cache: CacheEntry | null = null;

function cacheGet(): ParentAccount[] | null {
  if (!_cache) return null;
  if (Date.now() - _cache.ts > CACHE_TTL_MS) return null;
  return _cache.accounts;
}

function cacheSet(accounts: ParentAccount[], mtime: number): void {
  _cache = { accounts, ts: Date.now(), mtime };
}

function cacheInvalidate(): void {
  _cache = null;
}

// ---------------------------------------------------------------------------
// Activity-touch debouncing — calling updateAccount on every portal page/API
// request writes the whole accounts JSON to disk each time. Debounce to at
// most once per TOUCH_DEBOUNCE_MS per account.
// ---------------------------------------------------------------------------
const TOUCH_DEBOUNCE_MS = 60_000; // 1 minute
const _lastTouchByAccount = new Map<string, number>();

// ---------------------------------------------------------------------------

async function ensureFile(): Promise<ParentAccount[]> {
  const cached = cacheGet();
  if (cached) return cached;

  await mkdir(DIR, { recursive: true });
  try {
    let mtime = 0;
    try {
      const s = await stat(FILE);
      mtime = s.mtimeMs;
      if (_cache && _cache.mtime === mtime) {
        cacheSet(_cache.accounts, mtime);
        return _cache.accounts;
      }
    } catch { /* file may not exist yet */ }

    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw);
    const accounts = Array.isArray(parsed)
      ? parsed.filter((a): a is ParentAccount => Boolean(a && typeof a === "object" && a.id && a.emailLower))
      : [];
    cacheSet(accounts, mtime);
    return accounts;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      try {
        await writeFile(FILE, "[]", "utf8");
        cacheSet([], 0);
      } catch { /* ignore */ }
    }
    return [];
  }
}

async function writeStore(items: ParentAccount[]): Promise<void> {
  cacheInvalidate();
  await mkdir(DIR, { recursive: true });
  await writeFile(FILE, JSON.stringify(items, null, 2), "utf8");
}

export async function listParentAccounts(): Promise<ParentAccount[]> {
  return ensureFile();
}

export async function getAccountById(id: string): Promise<ParentAccount | null> {
  const all = await ensureFile();
  return all.find((a) => a.id === id) ?? null;
}

export async function getAccountByEmail(email: string): Promise<ParentAccount | null> {
  const lower = (email ?? "").trim().toLowerCase();
  if (!lower) return null;
  const all = await ensureFile();
  const key = parentEmailMatchKey(lower);
  return all.find((a) => parentEmailMatchKey(a.emailLower) === key) ?? null;
}

export async function getAccountByToken(token: string): Promise<ParentAccount | null> {
  if (!token) return null;
  const all = await ensureFile();
  return all.find((a) => a.sessionToken === token) ?? null;
}

export async function createAccount(input: CreateAccountInput): Promise<ParentAccount> {
  const all = await ensureFile();
  const now = new Date().toISOString();
  const account: ParentAccount = {
    id: randomUUID(),
    email: input.email,
    emailLower: input.email.trim().toLowerCase(),
    fullName: input.fullName,
    passwordHash: input.passwordHash,
    googleSubject: input.googleSubject,
    createdAt: now,
    updatedAt: now
  };
  all.push(account);
  await writeStore(all);
  return account;
}

export async function updateAccount(
  id: string,
  patch: Partial<Omit<ParentAccount, "id" | "createdAt" | "emailLower">>
): Promise<ParentAccount | null> {
  const all = await ensureFile();
  const idx = all.findIndex((a) => a.id === id);
  if (idx < 0) return null;
  const next: ParentAccount = {
    ...all[idx],
    ...patch,
    updatedAt: new Date().toISOString()
  };
  if (patch.email && patch.email !== all[idx].email) {
    next.email = patch.email;
    next.emailLower = patch.email.trim().toLowerCase();
  }
  all[idx] = next;
  await writeStore(all);
  return next;
}

export async function rotateSessionToken(id: string): Promise<{ account: ParentAccount; token: string } | null> {
  const token = randomBytes(32).toString("hex");
  const now = new Date().toISOString();
  _lastTouchByAccount.set(id, Date.now()); // Reset debounce after login.
  const updated = await updateAccount(id, {
    sessionToken: token,
    lastLoginAt: now,
    sessionLastActivityAt: now
  });
  if (!updated) return null;
  return { account: updated, token };
}

export async function clearSessionToken(id: string): Promise<void> {
  _lastTouchByAccount.delete(id);
  await updateAccount(id, { sessionToken: undefined, sessionLastActivityAt: undefined });
}

/**
 * Update portal session last-activity timestamp. Debounced to at most one
 * disk write per {@link TOUCH_DEBOUNCE_MS} per account so that every portal
 * page load doesn't rewrite the full accounts file to disk.
 */
export async function touchPortalAccountActivity(accountId: string): Promise<void> {
  const now = Date.now();
  const last = _lastTouchByAccount.get(accountId) ?? 0;
  if (now - last < TOUCH_DEBOUNCE_MS) return; // Debounce: skip write.
  _lastTouchByAccount.set(accountId, now);
  await updateAccount(accountId, { sessionLastActivityAt: new Date(now).toISOString() });
}

/** Default 7 days idle for parents (minutes). */
export function isPortalAccountIdleExpired(account: ParentAccount): boolean {
  if (!account.sessionLastActivityAt) return false;
  const mins = Number(process.env.PORTAL_SESSION_IDLE_MINUTES);
  const windowMs = (Number.isFinite(mins) && mins > 0 ? mins : 7 * 24 * 60) * 60 * 1000;
  return Date.now() - new Date(account.sessionLastActivityAt).getTime() > windowMs;
}
