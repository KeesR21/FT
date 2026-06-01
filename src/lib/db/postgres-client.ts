import postgres from "postgres";

let sql: postgres.Sql | null = null;

/** Direct TCP Postgres (Neon, Railway, Docker, local, Supabase “connection string”, etc.). */
export function getPostgresSql(): postgres.Sql {
  if (sql) return sql;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("Missing DATABASE_URL for direct PostgreSQL access.");
  }
  const max = Math.min(20, Math.max(1, Number(process.env.DATABASE_POOL_MAX ?? 8)));
  sql = postgres(url, {
    max,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 30
  });
  return sql;
}

export function isDirectPostgresConfigured(): boolean {
  if (process.env.USE_MOCK_DB === "true") return false;
  const url = (process.env.DATABASE_URL ?? "").trim();
  if (!url) return false;
  if (url.startsWith("mysql://") || url.startsWith("mysql2://")) return false;
  return url.startsWith("postgres://") || url.startsWith("postgresql://");
}
