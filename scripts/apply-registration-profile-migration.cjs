/**
 * Adds `players.registration_profile` (JSONB) on existing databases.
 * Usage: npm run db:migrate:registration-profile
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
    "20260426_registration_profile.sql"
  );
  const sqlText = fs.readFileSync(migrationPath, "utf8");
  const client = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    await client.unsafe(sqlText);
    console.log("registration_profile migration applied successfully.");
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error("Migration failed:", error.message || error);
  process.exit(1);
});
