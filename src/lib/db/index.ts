import { wrapMockDb } from "@/lib/db/mock-async";
import { createPostgresDb } from "@/lib/db/postgres-db";
import { isDirectPostgresConfigured } from "@/lib/db/postgres-client";
import { createSupabaseDb } from "@/lib/db/supabase-db";
import { db as mockSync } from "@/lib/mock-db";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import type { AppDb } from "@/lib/db/types";

export type { AdminShellSummary, AppDb } from "@/lib/db/types";

function createLiveDb(): AppDb {
  // `DATABASE_URL` + postgres driver (see `postgres-db.ts`). Set `USE_MOCK_DB=true` to skip.
  if (isDirectPostgresConfigured()) return createPostgresDb();
  if (isSupabaseConfigured()) return createSupabaseDb();
  return wrapMockDb(mockSync);
}

export const db: AppDb = createLiveDb();
