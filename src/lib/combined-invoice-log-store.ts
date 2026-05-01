import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const INVOICE_DIR = path.join(process.cwd(), "public", "uploads", "invoices");
const COMBINED_LOG_FILE = path.join(INVOICE_DIR, "combined-invoice-log.json");

export type CombinedInvoiceLineItem = {
  paymentId: string;
  playerId: string;
  playerName: string;
  ageGroup: string;
  description: string;
  amount: number;
};

export type CombinedInvoiceLog = {
  id: string;
  parentId: string;
  parentEmail: string;
  parentName: string;
  invoiceNumber: string;
  /** "April 2026", etc. */
  periodLabel: string;
  /** ISO date — common due date for the bundled players. */
  dueDate: string;
  currency: string;
  total: number;
  lineItems: CombinedInvoiceLineItem[];
  /** Snapshot of player IDs covered by this combined bill. */
  playerIds: string[];
  generatedAt: string;
  generatedBy: string;
  sentAt?: string;
  sentBy?: string;
  pdfUrl: string;
};

type CombinedFile = { entries: CombinedInvoiceLog[] };

async function ensureStore(): Promise<void> {
  await mkdir(INVOICE_DIR, { recursive: true });
  try {
    await readFile(COMBINED_LOG_FILE, "utf8");
  } catch {
    const empty: CombinedFile = { entries: [] };
    await writeFile(COMBINED_LOG_FILE, JSON.stringify(empty, null, 2), "utf8");
  }
}

async function readStore(): Promise<CombinedFile> {
  await ensureStore();
  try {
    const raw = await readFile(COMBINED_LOG_FILE, "utf8");
    const parsed = JSON.parse(raw) as CombinedFile;
    if (!Array.isArray(parsed.entries)) return { entries: [] };
    return { entries: parsed.entries };
  } catch {
    return { entries: [] };
  }
}

async function writeStore(file: CombinedFile): Promise<void> {
  await ensureStore();
  await writeFile(COMBINED_LOG_FILE, JSON.stringify(file, null, 2), "utf8");
}

export async function listCombinedInvoiceLogs(): Promise<CombinedInvoiceLog[]> {
  const file = await readStore();
  return [...file.entries].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
}

export async function getCombinedInvoiceLog(id: string): Promise<CombinedInvoiceLog | null> {
  const file = await readStore();
  return file.entries.find((e) => e.id === id) ?? null;
}

export async function createCombinedInvoiceLog(
  input: Omit<CombinedInvoiceLog, "id">
): Promise<CombinedInvoiceLog> {
  const file = await readStore();
  const entry: CombinedInvoiceLog = { ...input, id: randomUUID() };
  file.entries.push(entry);
  await writeStore(file);
  return entry;
}

export async function markCombinedInvoiceSent(
  id: string,
  sentBy: string
): Promise<CombinedInvoiceLog | null> {
  const file = await readStore();
  const hit = file.entries.find((e) => e.id === id);
  if (!hit) return null;
  hit.sentAt = new Date().toISOString();
  hit.sentBy = sentBy;
  await writeStore(file);
  return hit;
}
