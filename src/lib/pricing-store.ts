import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { AGE_GROUPS } from "@/lib/age-groups";

const PRICING_DIR = path.join(process.cwd(), "public", "uploads", "pricing");
const PRICING_FILE = path.join(PRICING_DIR, "pricing.json");

const ENV_DEFAULT_AMOUNT = Number(process.env.MONTHLY_FEE_AMOUNT ?? 45000);
const ENV_DEFAULT_REG_AMOUNT = Number(
  process.env.REGISTRATION_FEE_AMOUNT ?? process.env.MONTHLY_FEE_AMOUNT ?? 45000
);
const ENV_CURRENCY = process.env.PAYMENT_CURRENCY ?? "RWF";

export type GroupFee = {
  group: string;
  amount: number;
  currency: string;
  updatedAt: string;
  updatedBy: string;
};

export type RegistrationFeeVersion = {
  id: string;
  amount: number;
  currency: string;
  /** ISO date — only registrations created on/after this apply this version. */
  effectiveFrom: string;
  createdAt: string;
  createdBy: string;
  note?: string;
};

export type PricingFile = {
  /** Fallback monthly fee when a group has no override yet. */
  defaultMonthlyFee: { amount: number; currency: string; updatedAt: string; updatedBy: string };
  groupFees: GroupFee[];
  registrationFees: RegistrationFeeVersion[];
};

function safeAmount(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function defaultPricing(): PricingFile {
  const now = new Date().toISOString();
  const fallbackAmount = safeAmount(ENV_DEFAULT_AMOUNT, 45000);
  const fallbackRegAmount = safeAmount(ENV_DEFAULT_REG_AMOUNT, fallbackAmount);
  return {
    defaultMonthlyFee: {
      amount: fallbackAmount,
      currency: ENV_CURRENCY,
      updatedAt: now,
      updatedBy: "system"
    },
    groupFees: AGE_GROUPS.map((group) => ({
      group,
      amount: fallbackAmount,
      currency: ENV_CURRENCY,
      updatedAt: now,
      updatedBy: "system"
    })),
    registrationFees: [
      {
        id: randomUUID(),
        amount: fallbackRegAmount,
        currency: ENV_CURRENCY,
        effectiveFrom: now,
        createdAt: now,
        createdBy: "system",
        note: "Initial registration fee (from environment)."
      }
    ]
  };
}

async function ensureStore(): Promise<PricingFile> {
  await mkdir(PRICING_DIR, { recursive: true });
  try {
    const raw = await readFile(PRICING_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<PricingFile>;
    return reconcile(parsed);
  } catch {
    const fresh = defaultPricing();
    await writeFile(PRICING_FILE, JSON.stringify(fresh, null, 2), "utf8");
    return fresh;
  }
}

/** Make sure the file shape is complete (e.g. new groups added later, file from older release). */
function reconcile(partial: Partial<PricingFile>): PricingFile {
  const fresh = defaultPricing();
  const def = partial.defaultMonthlyFee && safeAmount(partial.defaultMonthlyFee.amount, 0) > 0
    ? {
        amount: safeAmount(partial.defaultMonthlyFee.amount, fresh.defaultMonthlyFee.amount),
        currency: partial.defaultMonthlyFee.currency || fresh.defaultMonthlyFee.currency,
        updatedAt: partial.defaultMonthlyFee.updatedAt || fresh.defaultMonthlyFee.updatedAt,
        updatedBy: partial.defaultMonthlyFee.updatedBy || fresh.defaultMonthlyFee.updatedBy
      }
    : fresh.defaultMonthlyFee;

  const existingByGroup = new Map<string, GroupFee>();
  for (const row of partial.groupFees ?? []) {
    if (!row || typeof row.group !== "string") continue;
    existingByGroup.set(row.group, {
      group: row.group,
      amount: safeAmount(row.amount, def.amount),
      currency: row.currency || def.currency,
      updatedAt: row.updatedAt || def.updatedAt,
      updatedBy: row.updatedBy || def.updatedBy
    });
  }
  const groupFees: GroupFee[] = AGE_GROUPS.map((g) => existingByGroup.get(g) ?? {
    group: g,
    amount: def.amount,
    currency: def.currency,
    updatedAt: def.updatedAt,
    updatedBy: def.updatedBy
  });

  let registrationFees: RegistrationFeeVersion[] = (partial.registrationFees ?? [])
    .filter((r): r is RegistrationFeeVersion => Boolean(r) && safeAmount(r.amount, 0) > 0 && typeof r.effectiveFrom === "string")
    .map((r) => ({
      id: r.id || randomUUID(),
      amount: safeAmount(r.amount, def.amount),
      currency: r.currency || def.currency,
      effectiveFrom: r.effectiveFrom,
      createdAt: r.createdAt || r.effectiveFrom,
      createdBy: r.createdBy || def.updatedBy,
      note: r.note
    }))
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  if (registrationFees.length === 0) {
    registrationFees = fresh.registrationFees;
  }

  return { defaultMonthlyFee: def, groupFees, registrationFees };
}

async function writeStore(file: PricingFile): Promise<void> {
  await mkdir(PRICING_DIR, { recursive: true });
  await writeFile(PRICING_FILE, JSON.stringify(file, null, 2), "utf8");
}

export async function loadPricing(): Promise<PricingFile> {
  return ensureStore();
}

export async function setGroupFee(input: {
  group: string;
  amount: number;
  currency: string;
  updatedBy: string;
}): Promise<PricingFile> {
  const file = await ensureStore();
  const amount = safeAmount(input.amount, 0);
  if (amount <= 0) throw new Error("Group fee amount must be greater than zero.");
  const currency = (input.currency || file.defaultMonthlyFee.currency).trim().toUpperCase();
  const now = new Date().toISOString();
  const existing = file.groupFees.find((g) => g.group === input.group);
  if (existing) {
    existing.amount = amount;
    existing.currency = currency;
    existing.updatedAt = now;
    existing.updatedBy = input.updatedBy;
  } else {
    file.groupFees.push({ group: input.group, amount, currency, updatedAt: now, updatedBy: input.updatedBy });
  }
  await writeStore(file);
  return file;
}

export async function setDefaultMonthlyFee(input: {
  amount: number;
  currency: string;
  updatedBy: string;
}): Promise<PricingFile> {
  const file = await ensureStore();
  const amount = safeAmount(input.amount, 0);
  if (amount <= 0) throw new Error("Default monthly fee must be greater than zero.");
  file.defaultMonthlyFee = {
    amount,
    currency: (input.currency || file.defaultMonthlyFee.currency).trim().toUpperCase(),
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy
  };
  await writeStore(file);
  return file;
}

export async function addRegistrationFeeVersion(input: {
  amount: number;
  currency: string;
  effectiveFrom: string;
  createdBy: string;
  note?: string;
}): Promise<PricingFile> {
  const file = await ensureStore();
  const amount = safeAmount(input.amount, 0);
  if (amount <= 0) throw new Error("Registration fee must be greater than zero.");
  const eff = (input.effectiveFrom || new Date().toISOString()).trim();
  const created = new Date().toISOString();
  file.registrationFees.push({
    id: randomUUID(),
    amount,
    currency: (input.currency || file.defaultMonthlyFee.currency).trim().toUpperCase(),
    effectiveFrom: eff,
    createdAt: created,
    createdBy: input.createdBy,
    note: input.note?.trim() || undefined
  });
  file.registrationFees.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  await writeStore(file);
  return file;
}

/** Latest registration fee that has taken effect at `at`. */
export function getActiveRegistrationFee(file: PricingFile, at: Date = new Date()): RegistrationFeeVersion {
  const cutoff = at.toISOString();
  const eligible = file.registrationFees
    .filter((r) => r.effectiveFrom <= cutoff)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  if (eligible[0]) return eligible[0];
  return file.registrationFees[file.registrationFees.length - 1] ?? defaultPricing().registrationFees[0]!;
}

export function getMonthlyFeeForGroup(
  file: PricingFile,
  group: string
): { amount: number; currency: string; matched: boolean } {
  const hit = file.groupFees.find((g) => g.group === group);
  if (hit) return { amount: hit.amount, currency: hit.currency, matched: true };
  return {
    amount: file.defaultMonthlyFee.amount,
    currency: file.defaultMonthlyFee.currency,
    matched: false
  };
}
