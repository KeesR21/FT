/**
 * Verify Supabase connection and required tables.
 * Usage: npm run db:verify
 */
const { createClient } = require("@supabase/supabase-js");
const { loadDotenvOptional } = require("./load-dotenv.cjs");

const REQUIRED_TABLES = [
  "site_config",
  "parents",
  "players",
  "payments",
  "timetable_sessions",
  "admin_messages"
];

async function main() {
  loadDotenvOptional();

  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  console.log("Supabase project:", url);
  console.log("Checking tables…\n");

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  let allOk = true;
  for (const table of REQUIRED_TABLES) {
    const { error } = await supabase.from(table).select("*", { count: "exact", head: true });
    if (error) {
      allOk = false;
      console.log(`  ✖  ${table} — ${error.message}`);
    } else {
      console.log(`  ✔  ${table}`);
    }
  }

  console.log("");
  if (allOk) {
    console.log("All required tables are reachable.");
    process.exit(0);
  }

  console.error("Some tables are missing or unreachable.");
  console.error("");
  console.error("Fix:");
  console.error("  1. Supabase Dashboard → Project Settings → Database → Connection string (URI)");
  console.error("  2. Add it to .env.local as DATABASE_URL=...");
  console.error("  3. Run: npm run db:setup:supabase");
  console.error("");
  console.error("Or paste db/schema.sql into Supabase → SQL Editor → Run.");
  process.exit(1);
}

main().catch((e) => {
  console.error("Verify failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
