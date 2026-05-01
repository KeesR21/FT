/**
 * Applies db/schema.sql to the database in DATABASE_URL (fresh or empty DB recommended).
 * Usage: npm run db:setup  (reads DATABASE_URL from .env.local if not set in the shell)
 */
const fs = require("fs");
const path = require("path");
const postgres = require("postgres");
const { loadDotenvOptional } = require("./load-dotenv.cjs");

async function main() {
  loadDotenvOptional();
  const url = (process.env.DATABASE_URL || "").trim();
  if (!url) {
    console.error("DATABASE_URL is required (e.g. in .env.local or the shell).");
    process.exit(1);
  }
  if (url.includes("YOUR_DB_PASSWORD")) {
    console.error(
      "Replace YOUR_DB_PASSWORD in .env.local with your real database password (Supabase: Project Settings → Database)."
    );
    process.exit(1);
  }

  const schemaPath = path.resolve(__dirname, "..", "db", "schema.sql");
  if (!fs.existsSync(schemaPath)) {
    console.error("Missing db/schema.sql");
    process.exit(1);
  }

  const sqlText = fs.readFileSync(schemaPath, "utf8");
  const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 45 });

  try {
    console.log("Applying db/schema.sql …");
    await sql.unsafe(sqlText);
    console.log("Schema applied successfully.");
  } catch (e) {
    console.error("Schema apply failed:", e instanceof Error ? e.message : e);
    process.exit(1);
  } finally {
    await sql.end({ timeout: 10 });
  }
}

main();
