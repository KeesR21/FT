#!/usr/bin/env node
/**
 * Verify MongoDB connection (uses embedded dev DB when local Mongo is not running).
 */
"use strict";
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8")
    .split("\n")
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const eq = trimmed.indexOf("=");
      if (eq < 1) return;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
      if (!process.env[key]) process.env[key] = val;
    });
}

const configured =
  process.env.MONGODB_URI || process.env.DATABASE_URL || "";

if (!configured.startsWith("mongodb://") && !configured.startsWith("mongodb+srv://")) {
  console.error("❌  Set MONGODB_URI in .env.local");
  process.exit(1);
}

const isLocal = /^mongodb:\/\/(127\.0\.0\.1|localhost):27017/i.test(configured);
const devMemory =
  process.env.MONGODB_DEV_MEMORY !== "false" &&
  process.env.NODE_ENV !== "production" &&
  (process.env.MONGODB_DEV_MEMORY === "true" || isLocal);

async function resolveUri() {
  const mongoose = require("mongoose");
  try {
    await mongoose.connect(configured, { serverSelectionTimeoutMS: 3000 });
    await mongoose.disconnect();
    return configured;
  } catch (err) {
    if (!devMemory) throw err;
    const { MongoMemoryServer } = require("mongodb-memory-server");
    const mem = await MongoMemoryServer.create();
    const base = mem.getUri();
    const uri = base.endsWith("/") ? `${base}ftpr-lions` : `${base}/ftpr-lions`;
    console.log("ℹ️  Local MongoDB not running — using embedded dev database.");
    return uri;
  }
}

async function main() {
  const uri = await resolveUri();
  const safe = uri.replace(/:\/\/([^@]+)@/, "://<credentials>@");
  console.log(`🔌  Connecting to: ${safe}`);

  const mongoose = require("mongoose");
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });

  const info = await mongoose.connection.db.admin().buildInfo();
  console.log(`✅  Connected! MongoDB version: ${info.version}`);

  const collections = await mongoose.connection.db.listCollections().toArray();
  if (collections.length === 0) {
    console.log("   No collections yet — created automatically on first save.");
  } else {
    console.log("   Collections:");
    collections.forEach((c) => console.log(`     • ${c.name}`));
  }

  await mongoose.disconnect();
  console.log("\n🎉  Database connected. Restart dev server: npm run dev");
}

main().catch((err) => {
  console.error("❌  Connection failed:", err.message);
  process.exit(1);
});
