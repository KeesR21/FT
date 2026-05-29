import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

/**
 * State for the academy-wide Kit Ordering window. Persists to a single JSON file
 * so the value survives dev-server restarts and is consistent for both admin and
 * public reads.
 */
export type KitOrderingPeriod = {
  enabled: boolean;
  /** ISO timestamp of last enable. */
  openedAt?: string;
  /** ISO timestamp of last disable. */
  closedAt?: string;
  openedBy?: string;
  closedBy?: string;
  /** Optional copy shown in the public banner / announcement. */
  announcement?: string;
};

const DIR = path.join(process.cwd(), "public", "uploads", "kits");
const FILE = path.join(DIR, "period.json");

const DEFAULT_ANNOUNCEMENT =
  "Kit ordering is now OPEN. Parents can sign in and place kit orders for each linked player.";

function defaultPeriod(): KitOrderingPeriod {
  return { enabled: false };
}

async function ensureStore(): Promise<KitOrderingPeriod> {
  await mkdir(DIR, { recursive: true });
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<KitOrderingPeriod>;
    return {
      enabled: Boolean(parsed.enabled),
      openedAt: typeof parsed.openedAt === "string" ? parsed.openedAt : undefined,
      closedAt: typeof parsed.closedAt === "string" ? parsed.closedAt : undefined,
      openedBy: typeof parsed.openedBy === "string" ? parsed.openedBy : undefined,
      closedBy: typeof parsed.closedBy === "string" ? parsed.closedBy : undefined,
      announcement: typeof parsed.announcement === "string" ? parsed.announcement : undefined
    };
  } catch {
    const fresh = defaultPeriod();
    await writeFile(FILE, JSON.stringify(fresh, null, 2), "utf8");
    return fresh;
  }
}

async function writeStore(value: KitOrderingPeriod): Promise<void> {
  await mkdir(DIR, { recursive: true });
  await writeFile(FILE, JSON.stringify(value, null, 2), "utf8");
}

export async function getKitOrderingPeriod(): Promise<KitOrderingPeriod> {
  return ensureStore();
}

export async function setKitOrderingEnabled(input: {
  enabled: boolean;
  by: string;
  announcement?: string;
}): Promise<KitOrderingPeriod> {
  const current = await ensureStore();
  if (current.enabled === input.enabled) {
    return current;
  }
  const now = new Date().toISOString();
  const next: KitOrderingPeriod = {
    enabled: input.enabled,
    openedAt: input.enabled ? now : current.openedAt,
    closedAt: input.enabled ? current.closedAt : now,
    openedBy: input.enabled ? input.by : current.openedBy,
    closedBy: input.enabled ? current.closedBy : input.by,
    announcement: input.announcement?.trim() || current.announcement || DEFAULT_ANNOUNCEMENT
  };
  await writeStore(next);
  return next;
}

export async function updateKitOrderingAnnouncement(input: {
  announcement: string;
  by: string;
}): Promise<KitOrderingPeriod> {
  const current = await ensureStore();
  current.announcement = input.announcement.trim() || DEFAULT_ANNOUNCEMENT;
  if (current.enabled) current.openedBy = input.by;
  await writeStore(current);
  return current;
}

export const KIT_ORDERING_DEFAULT_ANNOUNCEMENT = DEFAULT_ANNOUNCEMENT;
