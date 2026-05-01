/**
 * Inserts invoice demo parents/players (see db/seed-invoice-demo-players.sql).
 * Usage: npm run db:seed:invoice-demos
 */
const fs = require("fs");
const path = require("path");
const postgres = require("postgres");
const { loadDotenvOptional } = require("./load-dotenv.cjs");

async function main() {
  loadDotenvOptional();
  const url = (process.env.DATABASE_URL || "").trim();
  if (!url) {
    console.error("DATABASE_URL is required (e.g. in .env.local).");
    process.exit(1);
  }
  if (process.env.USE_MOCK_DB === "true") {
    console.error("USE_MOCK_DB is true — demo players are injected in mock-db on load; no SQL needed.");
    process.exit(0);
  }

  const seedPath = path.resolve(__dirname, "..", "db", "seed-invoice-demo-players.sql");
  if (!fs.existsSync(seedPath)) {
    console.error("Missing db/seed-invoice-demo-players.sql");
    process.exit(1);
  }

  const sqlText = fs.readFileSync(seedPath, "utf8");
  const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 45 });

  try {
    console.log("Applying invoice demo seed …");
    await sql.unsafe(sqlText);
    console.log("Done. Open Admin → Players and Admin → Finance → Invoices.");
  } catch (e) {
    console.error("Seed failed:", e instanceof Error ? e.message : e);
    process.exit(1);
  } finally {
    await sql.end({ timeout: 10 });
  }
}

main();
