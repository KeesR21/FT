/**
 * Load `.env.local` then `.env` into process.env without overriding existing vars.
 * Used by db scripts so `npm run db:setup` works the same as Next.js loading env.
 */
const fs = require("fs");
const path = require("path");

function loadDotenvOptional() {
  const root = path.join(__dirname, "..");
  for (const name of [".env.local", ".env"]) {
    const file = path.join(root, name);
    if (!fs.existsSync(file)) continue;
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq <= 0) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if (!key || process.env[key] !== undefined) continue;
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

module.exports = { loadDotenvOptional };
