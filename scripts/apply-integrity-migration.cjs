/**
 * Incremental migration for databases that already have core tables from an older `schema.sql`.
 * For a **new** database, prefer `npm run db:setup` (full schema) instead of this script.
 */
const fs = require("fs");
const path = require("path");
const postgres = require("postgres");
const { loadDotenvOptional } = require("./load-dotenv.cjs");

async function run() {
  loadDotenvOptional();
  const databaseUrl = (process.env.DATABASE_URL || "").trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to run DB migrations.");
  }
  if (databaseUrl.includes("YOUR_DB_PASSWORD")) {
    throw new Error("Replace YOUR_DB_PASSWORD in .env.local with your real database password.");
  }
  const migrationPath = path.resolve(
    process.cwd(),
    "db",
    "migrations",
    "20260420_parent_child_payment_integrity.sql"
  );
  const sqlText = fs.readFileSync(migrationPath, "utf8");
  const client = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    await client.unsafe(sqlText);
    console.log("Integrity migration applied successfully.");
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error("Integrity migration failed:", error.message || error);
  process.exit(1);
});
