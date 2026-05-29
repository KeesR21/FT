import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import type { ActivityLogEntry } from "@/lib/activity-log-types";

const DIR = path.join(process.cwd(), "public", "uploads", "activity-logs");
const FILE = path.join(DIR, "entries.json");

const MAX_ENTRIES = 25_000;

async function readAll(): Promise<ActivityLogEntry[]> {
  await mkdir(DIR, { recursive: true });
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e): e is ActivityLogEntry => Boolean(e && typeof e === "object" && "id" in e && "ts" in e));
  } catch {
    await writeFile(FILE, "[]", "utf8");
    return [];
  }
}

async function writeAll(items: ActivityLogEntry[]): Promise<void> {
  await mkdir(DIR, { recursive: true });
  await writeFile(FILE, JSON.stringify(items, null, 2), "utf8");
}

export async function appendActivityLog(entry: Omit<ActivityLogEntry, "id" | "ts"> & { id?: string; ts?: string }): Promise<void> {
  const full: ActivityLogEntry = {
    ...entry,
    id: entry.id ?? randomUUID(),
    ts: entry.ts ?? new Date().toISOString()
  };
  let all = await readAll();
  all.push(full);
  if (all.length > MAX_ENTRIES) {
    all = all.slice(-MAX_ENTRIES);
  }
  await writeAll(all);
}

export type ActivityLogQuery = {
  page?: number;
  pageSize?: number;
  action?: string;
  actorId?: string;
  resourceType?: string;
  from?: string;
  to?: string;
  q?: string;
};

export async function queryActivityLogs(query: ActivityLogQuery): Promise<{
  items: ActivityLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 50));
  const page = Math.max(1, query.page ?? 1);
  let all = await readAll();

  all.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));

  if (query.action?.trim()) {
    const a = query.action.trim().toLowerCase();
    all = all.filter((e) => e.action.toLowerCase() === a || e.action.toLowerCase().includes(a));
  }
  if (query.actorId?.trim()) {
    const id = query.actorId.trim().toLowerCase();
    all = all.filter((e) => (e.actorId ?? "").toLowerCase().includes(id));
  }
  if (query.resourceType?.trim()) {
    const t = query.resourceType.trim().toLowerCase();
    all = all.filter((e) => (e.resourceType ?? "").toLowerCase() === t);
  }
  if (query.from?.trim()) {
    const from = new Date(query.from).getTime();
    if (Number.isFinite(from)) all = all.filter((e) => new Date(e.ts).getTime() >= from);
  }
  if (query.to?.trim()) {
    const end = new Date(query.to);
    if (Number.isFinite(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      const toMs = end.getTime();
      all = all.filter((e) => new Date(e.ts).getTime() <= toMs);
    }
  }
  if (query.q?.trim()) {
    const q = query.q.trim().toLowerCase();
    all = all.filter(
      (e) =>
        e.description.toLowerCase().includes(q) ||
        (e.resourceId ?? "").toLowerCase().includes(q) ||
        (e.actorLabel ?? "").toLowerCase().includes(q)
    );
  }

  const total = all.length;
  const start = (page - 1) * pageSize;
  const items = all.slice(start, start + pageSize);
  return { items, total, page, pageSize };
}
