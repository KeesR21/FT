import { isMongoConfigured } from "@/lib/db/mongo-client";
import { isMysqlConfigured } from "@/lib/db/mysql-client";
import { isDirectPostgresConfigured } from "@/lib/db/postgres-client";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { issue } from "@/lib/audit/issue-factory";
import type { AuditIssue } from "@/lib/audit/types";
import { db } from "@/lib/db";

/**
 * Data-layer checks (lightweight, uses live db binding).
 */
export async function runDatabaseAudit(): Promise<AuditIssue[]> {
  const out: AuditIssue[] = [];
  const mock = process.env.USE_MOCK_DB === "true";
  const hasMongo = isMongoConfigured();
  const hasMysql = isMysqlConfigured();
  const hasPg = isDirectPostgresConfigured();
  const hasSupa = isSupabaseConfigured();

  if (mock) {
    out.push(
      issue({
        severity: "info",
        title: "In-memory (mock) database mode",
        description: "USE_MOCK_DB is enabled. Production data integrity and indexing cannot be verified against Postgres.",
        module: "Database",
        suggestedFix: "Run audits against a staging environment with DATABASE_URL to validate real database behavior."
      })
    );
  } else if (hasMongo) {
    out.push(
      issue({
        severity: "info",
        title: "MongoDB connection configured",
        description: "App is using MongoDB (Mongoose). Verify indexes and backups for production.",
        module: "Database"
      })
    );
  } else if (hasMysql) {
    out.push(
      issue({
        severity: "info",
        title: "MySQL connection configured",
        description: "App is using MySQL (e.g. Hostinger). Verify backups and that schema was applied (npm run db:setup:mysql).",
        module: "Database"
      })
    );
  } else if (hasPg) {
    out.push(
      issue({
        severity: "info",
        title: "PostgreSQL connection configured",
        description: "App is using direct PostgreSQL. Verify backups, migrations, and connection pooling in production.",
        module: "Database"
      })
    );
  } else if (hasSupa) {
    out.push(
      issue({
        severity: "info",
        title: "Supabase client configured",
        description: "Database access may use Supabase. Review RLS policies in Supabase dashboard for security.",
        module: "Database"
      })
    );
  } else {
    out.push(
      issue({
        severity: "low",
        title: "No persistent database connection detected",
        description: "Fallback in-memory store may be in use; confirm environment configuration for non-dev deploys.",
        module: "Database"
      })
    );
  }

  try {
    const players = await db.listPlayers({ includeWithdrawn: true, registration: "all" });
    const names = players.map((p) => p.playerName.trim().toLowerCase());
    const dupes = names.filter((n, i) => n && names.indexOf(n) !== i);
    const uniqueDupes = [...new Set(dupes)];
    if (uniqueDupes.length > 0) {
      out.push(
        issue({
          severity: "medium",
          title: "Duplicate player names in roster",
          description: `Found ${uniqueDupes.length} duplicated name(s): ${uniqueDupes.slice(0, 5).join(", ")}${uniqueDupes.length > 5 ? "…" : ""}.`,
          module: "Database",
          suggestedFix: "Disambiguate in UI or enforce uniqueness per parent+DOB if business rules require it."
        })
      );
    } else {
      out.push(
        issue({
          severity: "info",
          title: "No duplicate lowercased player names in current data",
          description: `Roster has ${players.length} player record(s) without obvious name collisions in this check.`,
          module: "Database"
        })
      );
    }
  } catch (e) {
    out.push(
      issue({
        severity: "high",
        title: "Database connectivity check failed",
        description: e instanceof Error ? e.message : "Unknown error when listing players.",
        module: "Database"
      })
    );
  }

  return out;
}
