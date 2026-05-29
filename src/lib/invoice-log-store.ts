import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import type { AdminInvoiceLog } from "@/lib/types";

const INVOICE_DIR = path.join(process.cwd(), "public", "uploads", "invoices");
const LOG_FILE = path.join(INVOICE_DIR, "invoice-log.json");

type InvoiceLogFile = { entries: AdminInvoiceLog[] };

async function ensureStore(): Promise<void> {
  await mkdir(INVOICE_DIR, { recursive: true });
  try {
    await readFile(LOG_FILE, "utf8");
  } catch {
    const empty: InvoiceLogFile = { entries: [] };
    await writeFile(LOG_FILE, JSON.stringify(empty, null, 2), "utf8");
  }
}

async function readStore(): Promise<InvoiceLogFile> {
  await ensureStore();
  try {
    const raw = await readFile(LOG_FILE, "utf8");
    const parsed = JSON.parse(raw) as InvoiceLogFile;
    if (!Array.isArray(parsed.entries)) return { entries: [] };
    return { entries: parsed.entries };
  } catch {
    return { entries: [] };
  }
}

async function writeStore(file: InvoiceLogFile): Promise<void> {
  await ensureStore();
  await writeFile(LOG_FILE, JSON.stringify(file, null, 2), "utf8");
}

export async function listInvoiceLogs(): Promise<AdminInvoiceLog[]> {
  const file = await readStore();
  return [...file.entries].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
}

export async function createInvoiceLog(
  input: Omit<AdminInvoiceLog, "id">
): Promise<AdminInvoiceLog> {
  const file = await readStore();
  const entry: AdminInvoiceLog = { ...input, id: randomUUID() };
  file.entries.push(entry);
  await writeStore(file);
  return entry;
}

export async function markInvoiceSent(logId: string, sentBy: string): Promise<AdminInvoiceLog | null> {
  const file = await readStore();
  const hit = file.entries.find((e) => e.id === logId);
  if (!hit) return null;
  hit.sentAt = new Date().toISOString();
  hit.sentBy = sentBy;
  await writeStore(file);
  return hit;
}

export async function getInvoiceLog(logId: string): Promise<AdminInvoiceLog | null> {
  const file = await readStore();
  return file.entries.find((e) => e.id === logId) ?? null;
}

/** Repoint a log to a payment row (e.g. after mock DB reset while invoice-log.json persisted). */
export async function updateInvoiceLogPaymentId(
  logId: string,
  paymentId: string
): Promise<AdminInvoiceLog | null> {
  const file = await readStore();
  const hit = file.entries.find((e) => e.id === logId);
  if (!hit) return null;
  hit.paymentId = paymentId;
  await writeStore(file);
  return hit;
}

/** Wipe every invoice log and the generated PDFs alongside them. Used by the admin "wipe players" tool. */
export async function clearInvoiceLogs(): Promise<{ removedPdfs: number }> {
  const empty: InvoiceLogFile = { entries: [] };
  await mkdir(INVOICE_DIR, { recursive: true });
  await writeFile(LOG_FILE, JSON.stringify(empty, null, 2), "utf8");
  let removedPdfs = 0;
  try {
    const { readdir, unlink } = await import("fs/promises");
    const entries = await readdir(INVOICE_DIR);
    for (const name of entries) {
      if (/\.pdf$/i.test(name)) {
        try {
          await unlink(path.join(INVOICE_DIR, name));
          removedPdfs += 1;
        } catch {
          /* best effort */
        }
      }
    }
  } catch {
    /* directory may be missing or empty */
  }
  return { removedPdfs };
}

