import { randomUUID } from "crypto";
import type { Pool, PoolConnection } from "mysql2/promise";

export type Queryable = Pool | PoolConnection;

export async function queryRows<T>(
  db: Queryable,
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const [rows] = await db.query(sql, params);
  return rows as T[];
}

export async function queryOne<T>(
  db: Queryable,
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await queryRows<T>(db, sql, params);
  return rows[0] ?? null;
}

export function newId(): string {
  return randomUUID();
}

export function jsonParam(value: unknown): string {
  return JSON.stringify(value ?? null);
}

/** Build `col = ?` SET clause for partial updates. JSON values are stringified. */
export function buildUpdateSet(
  patch: Record<string, unknown>,
  jsonKeys = new Set<string>()
): { sql: string; values: unknown[] } {
  const keys = Object.keys(patch);
  if (keys.length === 0) return { sql: "", values: [] };
  const parts: string[] = [];
  const values: unknown[] = [];
  for (const key of keys) {
    parts.push(`${key} = ?`);
    const v = patch[key];
    values.push(jsonKeys.has(key) ? jsonParam(v) : v);
  }
  return { sql: parts.join(", "), values };
}
