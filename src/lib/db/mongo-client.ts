import mongoose from "mongoose";

let connectionPromise: Promise<typeof mongoose> | null = null;
let memoryServer: { stop: () => Promise<boolean>; getUri: () => string } | null = null;
let resolvedUri: string | null = null;

function mongoUrl(): string {
  return (process.env.MONGODB_URI ?? process.env.DATABASE_URL ?? "").trim();
}

export function isMongoConfigured(): boolean {
  if (process.env.USE_MOCK_DB === "true") return false;
  const url = mongoUrl();
  return url.startsWith("mongodb://") || url.startsWith("mongodb+srv://");
}

function isLocalMongoUri(uri: string): boolean {
  return /^mongodb:\/\/(127\.0\.0\.1|localhost):27017/i.test(uri);
}

function devMemoryFallbackEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.MONGODB_DEV_MEMORY === "false") return false;
  return process.env.MONGODB_DEV_MEMORY === "true" || isLocalMongoUri(mongoUrl());
}

/** Ping local MongoDB; if unavailable in dev, start embedded MongoDB (no Docker required). */
async function resolveMongoUri(): Promise<string> {
  if (resolvedUri) return resolvedUri;

  const configured = mongoUrl();
  if (!configured) {
    throw new Error(
      "Missing MONGODB_URI (mongodb://... or mongodb+srv://...) for MongoDB connection."
    );
  }

  if (!devMemoryFallbackEnabled() || !isLocalMongoUri(configured)) {
    resolvedUri = configured;
    return configured;
  }

  try {
    await mongoose.connect(configured, {
      serverSelectionTimeoutMS: 2500,
      bufferCommands: false
    });
    await mongoose.disconnect();
    resolvedUri = configured;
    return configured;
  } catch {
    if (!memoryServer) {
      const { MongoMemoryServer } = await import("mongodb-memory-server");
      memoryServer = await MongoMemoryServer.create();
      if (process.env.NODE_ENV !== "production") {
        console.info(
          "[db] Local MongoDB not running — using embedded dev database:",
          memoryServer.getUri()
        );
      }
    }
    const base = memoryServer.getUri();
    resolvedUri = base.endsWith("/") ? `${base}ftpr-lions` : `${base}/ftpr-lions`;
    return resolvedUri;
  }
}

/**
 * Returns a shared cached Mongoose connection.
 * In Next.js each serverless/edge invocation reuses the same Node process —
 * caching the promise avoids opening a new connection on every request.
 */
export async function connectMongo(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState >= 1) return mongoose;
  if (connectionPromise) return connectionPromise;

  const url = await resolveMongoUri();

  connectionPromise = mongoose.connect(url, {
    dbName: process.env.MONGODB_DB ?? undefined,
    bufferCommands: false,
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 8000,
    maxPoolSize: Math.min(20, Math.max(1, Number(process.env.DATABASE_POOL_MAX ?? 8)))
  });

  return connectionPromise;
}
