/**
 * Applies db/schema.mysql.sql to the database in DATABASE_URL (mysql://...).
 * Usage: npm run db:setup:mysql
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const { loadDotenvOptional } = require("./load-dotenv.cjs");

function parseMysqlUrl(url) {
  const parsed = new URL(url.replace(/^mysql2:\/\//, "mysql://"));
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ""),
    multipleStatements: true
  };
}

async function main() {
  loadDotenvOptional();
  const url = (process.env.DATABASE_URL || "").trim();
  if (!url.startsWith("mysql://") && !url.startsWith("mysql2://")) {
    console.error("DATABASE_URL must be a mysql:// connection string.");
    console.error("Example: mysql://user:password@localhost:3306/academy");
    process.exit(1);
  }

  const schemaPath = path.resolve(__dirname, "..", "db", "schema.mysql.sql");
  const sqlText = fs.readFileSync(schemaPath, "utf8");

  const conn = await mysql.createConnection(parseMysqlUrl(url));
  try {
    console.log("Applying db/schema.mysql.sql …");
    await conn.query(sqlText);
    console.log("MySQL schema applied successfully.");
  } catch (e) {
    console.error("Schema apply failed:", e instanceof Error ? e.message : e);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

main();
