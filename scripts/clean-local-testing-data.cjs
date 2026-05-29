/**
 * Wipes local file-backed testing data under public/uploads/ and optionally truncates Postgres.
 *
 * Usage:
 *   npm run db:clean:local
 *
 * Postgres (when DATABASE_URL is set and USE_MOCK_DB is not "true"):
 *   - URLs pointing at localhost / 127.0.0.1 / ::1 truncate without extra confirmation.
 *   - Any other host requires CONFIRM_CLEAN=YES in the environment.
 *
 * site_config row id=1 is preserved with content reset to {} (CMS singleton).
 */

const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const postgres = require("postgres");
const { loadDotenvOptional } = require("./load-dotenv.cjs");

const AGE_GROUPS = ["U7", "U9", "U11", "U14A", "U14B", "U16", "U18"];

function log(msg) {
  console.log(`[clean-local] ${msg}`);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, obj) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), "utf8");
  log(`Wrote ${path.relative(process.cwd(), filePath)}`);
}

function removePdfArtifacts(dir, label) {
  if (!fs.existsSync(dir)) return 0;
  let n = 0;
  for (const name of fs.readdirSync(dir)) {
    if (/\.pdf$/i.test(name)) {
      try {
        fs.unlinkSync(path.join(dir, name));
        n += 1;
      } catch {
        /* ignore */
      }
    }
  }
  if (n) log(`Removed ${n} PDF file(s) from ${label}`);
  return n;
}

function buildDefaultPricing() {
  const monthly = Number(process.env.MONTHLY_FEE_AMOUNT ?? 45000);
  const reg = Number(process.env.REGISTRATION_FEE_AMOUNT ?? process.env.MONTHLY_FEE_AMOUNT ?? 45000);
  const currency = (process.env.PAYMENT_CURRENCY ?? "RWF").trim() || "RWF";
  const now = new Date().toISOString();
  const safe = (v, fb) => (Number.isFinite(v) && v > 0 ? v : fb);
  const m = safe(monthly, 45000);
  const r = safe(reg, m);
  return {
    defaultMonthlyFee: { amount: m, currency, updatedAt: now, updatedBy: "system" },
    groupFees: AGE_GROUPS.map((group) => ({
      group,
      amount: m,
      currency,
      updatedAt: now,
      updatedBy: "system"
    })),
    registrationFees: [
      {
        id: randomUUID(),
        amount: r,
        currency,
        effectiveFrom: now,
        createdAt: now,
        createdBy: "system",
        note: "Initial registration fee (from environment / clean script)."
      }
    ]
  };
}

function isLikelyLocalPostgresUrl(urlStr) {
  const u = (urlStr || "").trim();
  if (!u) return false;
  // Avoid new URL() — passwords may contain @ or other characters.
  const m = u.match(/@([^/?]+)(?:\/|\?|$)/);
  if (!m) return false;
  const hostPort = m[1];
  const host = hostPort.split(":")[0].replace(/^\[/, "").replace(/\]$/, "");
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

async function truncatePostgres(url) {
  const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 45 });
  try {
    log("Truncating Postgres tables (app data only) …");
    await sql`
      TRUNCATE TABLE
        admin_messages,
        performance_entries,
        payments,
        players,
        parents,
        timetable_sessions,
        users
      RESTART IDENTITY CASCADE
    `;
    await sql`
      INSERT INTO site_config (id, content, updated_at)
      VALUES (1, '{}'::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE
      SET content = EXCLUDED.content, updated_at = EXCLUDED.updated_at
    `;
    log("Postgres: tables truncated; site_config.content set to {}.");
  } finally {
    await sql.end({ timeout: 10 });
  }
}

async function main() {
  loadDotenvOptional();
  const root = path.join(__dirname, "..");
  const uploads = path.join(root, "public", "uploads");

  log("Starting file-backed store cleanup …");

  writeJson(path.join(uploads, "activity-logs", "entries.json"), []);
  writeJson(path.join(uploads, "parent-accounts", "accounts.json"), []);
  writeJson(path.join(uploads, "admin-auth", "credentials.json"), { credentials: null });
  writeJson(path.join(uploads, "password-resets", "tokens.json"), []);
  writeJson(path.join(uploads, "kit-orders", "orders.json"), []);
  writeJson(path.join(uploads, "kits", "kits.json"), []);
  writeJson(path.join(uploads, "kits", "period.json"), { enabled: false });

  const invDir = path.join(uploads, "invoices");
  writeJson(path.join(invDir, "invoice-log.json"), { entries: [] });
  writeJson(path.join(invDir, "combined-invoice-log.json"), { entries: [] });
  removePdfArtifacts(invDir, "public/uploads/invoices");

  writeJson(path.join(uploads, "pricing", "pricing.json"), buildDefaultPricing());

  const auditDir = path.join(uploads, "audits");
  writeJson(path.join(auditDir, "audit-history.json"), { runs: [] });
  removePdfArtifacts(auditDir, "public/uploads/audits");

  log("File cleanup finished (CMS kit photos under public/uploads/kits/ etc. were not removed).");

  const useMock = String(process.env.USE_MOCK_DB || "").toLowerCase() === "true";
  const dbUrl = (process.env.DATABASE_URL || "").trim();

  if (useMock) {
    log("USE_MOCK_DB=true — skipping Postgres (in-memory mock resets when the dev server restarts).");
    return;
  }

  if (!dbUrl) {
    log("No DATABASE_URL — skipping Postgres truncate.");
    return;
  }

  if (!isLikelyLocalPostgresUrl(dbUrl)) {
    log("WARNING: DATABASE_URL host is not localhost/127.0.0.1/::1 — this may be a remote database.");
    if (String(process.env.CONFIRM_CLEAN || "").trim() !== "YES") {
      log("Refusing Postgres truncate. Set CONFIRM_CLEAN=YES to proceed, or unset DATABASE_URL for file-only clean.");
      process.exit(1);
    }
    log("CONFIRM_CLEAN=YES — proceeding with Postgres truncate.");
  } else {
    log("DATABASE_URL looks local — truncating Postgres without CONFIRM_CLEAN.");
  }

  await truncatePostgres(dbUrl);
}

main().catch((e) => {
  console.error("[clean-local] Failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
