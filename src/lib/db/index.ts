import { wrapMockDb } from "@/lib/db/mock-async";
import { createMysqlDb } from "@/lib/db/mysql-db";
import { isMysqlConfigured } from "@/lib/db/mysql-client";
import { createPostgresDb } from "@/lib/db/postgres-db";
import { isDirectPostgresConfigured } from "@/lib/db/postgres-client";
import { createSupabaseDb } from "@/lib/db/supabase-db";
import { db as mockSync } from "@/lib/mock-db";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import type { AppDb } from "@/lib/db/types";

export type { AdminShellSummary, AppDb } from "@/lib/db/types";

function createLiveDb(): AppDb {
  // Priority: MySQL (Hostinger) → PostgreSQL URL → Supabase API → in-memory mock
  if (isMysqlConfigured()) return createMysqlDb();
  if (isDirectPostgresConfigured()) return createPostgresDb();
  if (isSupabaseConfigured()) return createSupabaseDb();
  return wrapMockDb(mockSync);
}

export const db: AppDb = createLiveDb();
