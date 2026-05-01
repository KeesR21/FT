/**
 * One-time local setup: creates .env.local from .env.example if it does not exist.
 * Your secrets stay only on this machine (.env*.local is gitignored).
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.join(__dirname, "..");
const example = path.join(root, ".env.example");
const local = path.join(root, ".env.local");

if (!fs.existsSync(example)) {
  console.error("Missing .env.example");
  process.exit(1);
}

if (fs.existsSync(local)) {
  console.log(".env.local already exists — leaving it unchanged.");
  console.log(`Edit: ${local}`);
  process.exit(0);
}

let text = fs.readFileSync(example, "utf8");
if (/^JWT_SECRET=$/m.test(text) || /JWT_SECRET=replace-with-strong-secret/.test(text)) {
  const secret = crypto.randomBytes(32).toString("hex");
  text = text.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret}`);
}

fs.writeFileSync(local, text, "utf8");
console.log(`Created ${local}`);
console.log("");
console.log("Database (pick one):");
console.log("  A) Direct Postgres: set DATABASE_URL");
console.log("     → local: npm run db:compose:up  then  npm run db:setup");
console.log("     → hosted (Neon/Railway/etc.): set DATABASE_URL then npm run db:setup once");
console.log("  B) Supabase API: set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (no DATABASE_URL)");
console.log("     → or use Supabase Postgres connection string as DATABASE_URL + npm run db:setup");
console.log("  Priority: DATABASE_URL wins over Supabase if both are set.");
console.log("  Leave USE_MOCK_DB empty (or false) to use a real database.");
console.log("");
console.log(`Open for editing: ${local}`);
