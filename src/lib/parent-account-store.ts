import { mkdir, readFile, writeFile } from "fs/promises";
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

async function ensureFile(): Promise<ParentAccount[]> {
  await mkdir(DIR, { recursive: true });
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((a): a is ParentAccount => Boolean(a && typeof a === "object" && a.id && a.emailLower));
  } catch {
    await writeFile(FILE, "[]", "utf8");
    return [];
  }
}

async function writeStore(items: ParentAccount[]): Promise<void> {
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
  const updated = await updateAccount(id, {
    sessionToken: token,
    lastLoginAt: now,
    sessionLastActivityAt: now
  });
  if (!updated) return null;
  return { account: updated, token };
}

export async function clearSessionToken(id: string): Promise<void> {
  await updateAccount(id, { sessionToken: undefined, sessionLastActivityAt: undefined });
}

export async function touchPortalAccountActivity(accountId: string): Promise<void> {
  await updateAccount(accountId, { sessionLastActivityAt: new Date().toISOString() });
}

/** Default 7 days idle for parents (minutes). */
export function isPortalAccountIdleExpired(account: ParentAccount): boolean {
  if (!account.sessionLastActivityAt) return false;
  const mins = Number(process.env.PORTAL_SESSION_IDLE_MINUTES);
  const windowMs = (Number.isFinite(mins) && mins > 0 ? mins : 7 * 24 * 60) * 60 * 1000;
  return Date.now() - new Date(account.sessionLastActivityAt).getTime() > windowMs;
}
