import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { createHash, randomBytes } from "crypto";

export type PasswordResetScope = "admin" | "parent";

export type PasswordResetRecord = {
  id: string;
  scope: PasswordResetScope;
  /** Normalized identifier (email lower). */
  identifier: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
};

const DIR = path.join(process.cwd(), "public", "uploads", "password-resets");
const FILE = path.join(DIR, "tokens.json");

/** 45 minutes */
const TTL_MS = 45 * 60 * 1000;

export function hashPasswordResetToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

async function readAll(): Promise<PasswordResetRecord[]> {
  await mkdir(DIR, { recursive: true });
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is PasswordResetRecord =>
        Boolean(r && typeof r === "object" && "id" in r && "tokenHash" in r && "scope" in r && "identifier" in r)
    );
  } catch {
    await writeFile(FILE, "[]", "utf8");
    return [];
  }
}

async function writeAll(items: PasswordResetRecord[]): Promise<void> {
  await mkdir(DIR, { recursive: true });
  await writeFile(FILE, JSON.stringify(items, null, 2), "utf8");
}

function prune(records: PasswordResetRecord[]): PasswordResetRecord[] {
  const now = Date.now();
  return records.filter((r) => new Date(r.expiresAt).getTime() > now);
}

/**
 * Creates a new reset token; any prior unconsumed token for the same scope+identifier is replaced.
 */
export async function issuePasswordResetToken(
  scope: PasswordResetScope,
  identifier: string
): Promise<{ rawToken: string; record: PasswordResetRecord }> {
  let records = prune(await readAll());
  const id = randomBytes(16).toString("hex");
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashPasswordResetToken(rawToken);
  const now = new Date();
  const identifierNorm = identifier.trim().toLowerCase();
  const expiresAt = new Date(now.getTime() + TTL_MS).toISOString();
  const record: PasswordResetRecord = {
    id,
    scope,
    identifier: identifierNorm,
    tokenHash,
    expiresAt,
    createdAt: now.toISOString()
  };
  records = records.filter((r) => !(r.scope === scope && r.identifier === identifierNorm));
  records.push(record);
  await writeAll(records);
  return { rawToken, record };
}

/** Validates and removes the token (single use). */
export async function consumePasswordResetToken(
  rawToken: string,
  scope: PasswordResetScope
): Promise<PasswordResetRecord | null> {
  const records = prune(await readAll());
  const hash = hashPasswordResetToken(rawToken.trim());
  const idx = records.findIndex((r) => r.scope === scope && r.tokenHash === hash);
  if (idx < 0) {
    await writeAll(records);
    return null;
  }
  const [found] = records.splice(idx, 1);
  await writeAll(records);
  return found ?? null;
}
