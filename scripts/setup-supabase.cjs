/**
 * One-time Supabase setup:
 *  1. Apply db/schema.sql (requires DATABASE_URL)
 *  2. Verify all tables exist
 *  3. Seed site_config from data/site-content.json if present
 *
 * Usage: npm run db:setup:supabase
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { createClient } = require("@supabase/supabase-js");
const { loadDotenvOptional } = require("./load-dotenv.cjs");

async function verifyTables(supabase) {
  const tables = ["site_config", "parents", "players", "payments"];
  for (const table of tables) {
    const { error } = await supabase.from(table).select("*", { count: "exact", head: true });
    if (error) return false;
  }
  return true;
}

async function seedSiteContent(supabase) {
  const file = path.join(process.cwd(), "data", "site-content.json");
  let content = {};
  if (fs.existsSync(file)) {
    content = JSON.parse(fs.readFileSync(file, "utf8"));
    console.log("Seeding site_config from data/site-content.json …");
  } else {
    console.log("No data/site-content.json — seeding empty site_config (app uses defaults on read).");
  }

  const { error } = await supabase.from("site_config").upsert(
    { id: 1, content, updated_at: new Date().toISOString() },
    { onConflict: "id" }
  );
  if (error) throw error;
  console.log("site_config ready.");
}

async function main() {
  loadDotenvOptional();

  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const databaseUrl = (process.env.DATABASE_URL || "").trim();

  if (!url || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  let tablesOk = await verifyTables(supabase);

  if (!tablesOk) {
    if (!databaseUrl) {
      console.error("");
      console.error("Tables not found. Add DATABASE_URL to .env.local first:");
      console.error("  Supabase Dashboard → Project Settings → Database → Connection string (URI)");
      console.error("  Example:");
      console.error(
        "  DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
      );
      console.error("");
      console.error("Then run this script again.");
      process.exit(1);
    }

    if (databaseUrl.includes("YOUR_DB_PASSWORD")) {
      console.error("Replace YOUR_DB_PASSWORD in DATABASE_URL with your real Supabase database password.");
      process.exit(1);
    }

    console.log("Applying db/schema.sql …");
    execSync("node scripts/apply-schema.cjs", { stdio: "inherit", env: process.env });
    tablesOk = await verifyTables(supabase);
    if (!tablesOk) {
      console.error("Schema applied but tables still unreachable — check Supabase project status.");
      process.exit(1);
    }
  } else {
    console.log("Tables already exist — skipping schema apply.");
  }

  await seedSiteContent(supabase);

  console.log("");
  console.log("✔  Supabase setup complete.");
  console.log("   Set USE_MOCK_DB=false in .env.local (already done if you ran the switch).");
  console.log("   Restart the app: npm run dev");
}

main().catch((e) => {
  console.error("Setup failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
