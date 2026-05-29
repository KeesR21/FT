/**
 * Kit catalog — rows are never removed from JSON (academy policy).
 * Retire kits with `active: false` and optional `archivedAt`; photos stay on disk for historical orders.
 */
import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export type KitItem = {
  id: string;
  type: string;
  color: string;
  description?: string;
  /** Available sizes (display order preserved). */
  sizes: string[];
  photoUrl?: string;
  price: number;
  currency: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  /** When the kit was retired from the catalog (row retained forever). */
  archivedAt?: string;
};

export type KitItemPatch = Partial<Omit<KitItem, "id" | "createdAt" | "updatedAt">> & {
  updatedBy?: string;
};

const DIR = path.join(process.cwd(), "public", "uploads", "kits");
const FILE = path.join(DIR, "kits.json");

/**
 * Academy-wide currency. We standardise on RWF for all kit pricing so legacy
 * records (originally created with the XAF default) display consistently.
 */
const ACADEMY_CURRENCY = "RWF";

async function ensureFile(): Promise<KitItem[]> {
  await mkdir(DIR, { recursive: true });
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((it): it is KitItem => Boolean(it && typeof it === "object" && it.id))
      .map((it) => ({ ...it, currency: ACADEMY_CURRENCY }));
  } catch {
    try {
      await rename(FILE, path.join(DIR, `kits.invalid-${Date.now()}.json`));
    } catch {
      /* no existing file */
    }
    await writeFile(FILE, "[]", "utf8");
    return [];
  }
}

async function writeFileStore(items: KitItem[]): Promise<void> {
  await mkdir(DIR, { recursive: true });
  await writeFile(FILE, JSON.stringify(items, null, 2), "utf8");
}

export async function listKits(opts?: { includeInactive?: boolean }): Promise<KitItem[]> {
  const all = await ensureFile();
  const sorted = [...all].sort((a, b) => (a.type === b.type ? a.color.localeCompare(b.color) : a.type.localeCompare(b.type)));
  if (opts?.includeInactive) return sorted;
  return sorted.filter((k) => k.active);
}

export async function getKit(id: string): Promise<KitItem | null> {
  const all = await ensureFile();
  return all.find((k) => k.id === id) ?? null;
}

export async function createKit(input: Omit<KitItem, "id" | "createdAt" | "updatedAt">): Promise<KitItem> {
  const all = await ensureFile();
  const now = new Date().toISOString();
  const item: KitItem = {
    ...input,
    currency: ACADEMY_CURRENCY,
    id: randomUUID(),
    sizes: dedupSizes(input.sizes),
    createdAt: now,
    updatedAt: now
  };
  all.push(item);
  await writeFileStore(all);
  return item;
}

export async function updateKit(id: string, patch: KitItemPatch): Promise<KitItem | null> {
  const all = await ensureFile();
  const idx = all.findIndex((k) => k.id === id);
  if (idx < 0) return null;
  const next: KitItem = {
    ...all[idx],
    ...patch,
    currency: ACADEMY_CURRENCY,
    sizes: patch.sizes ? dedupSizes(patch.sizes) : all[idx].sizes,
    updatedAt: new Date().toISOString()
  };
  all[idx] = next;
  await writeFileStore(all);
  return next;
}

/**
 * Retire a kit from the storefront without removing its row or uploaded assets (order history stays intact).
 */
export async function archiveKit(id: string): Promise<KitItem | null> {
  const now = new Date().toISOString();
  return updateKit(id, { active: false, archivedAt: now });
}

function dedupSizes(sizes: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of sizes) {
    const trimmed = (raw ?? "").trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}
