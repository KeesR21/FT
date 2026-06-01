import mysql from "mysql2/promise";

let pool: mysql.Pool | null = null;

function databaseUrl(): string {
  return (process.env.DATABASE_URL ?? "").trim();
}

export function isMysqlConfigured(): boolean {
  if (process.env.USE_MOCK_DB === "true") return false;
  const url = databaseUrl();
  return url.startsWith("mysql://") || url.startsWith("mysql2://");
}

/** Parse mysql://user:pass@host:port/db into mysql2 pool options. */
function parseMysqlUrl(url: string): mysql.PoolOptions {
  const parsed = new URL(url.replace(/^mysql2:\/\//, "mysql://"));
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ""),
    waitForConnections: true,
    connectionLimit: Math.min(20, Math.max(1, Number(process.env.DATABASE_POOL_MAX ?? 8))),
    enableKeepAlive: true,
    charset: "utf8mb4",
    timezone: "Z"
  };
}

export function getMysqlPool(): mysql.Pool {
  if (pool) return pool;
  const url = databaseUrl();
  if (!url) {
    throw new Error("Missing DATABASE_URL for MySQL (mysql://user:pass@host:3306/database).");
  }
  pool = mysql.createPool(parseMysqlUrl(url));
  return pool;
}
