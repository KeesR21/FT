import { beforeEach, vi } from "vitest";
import { resetMockDb } from "@/lib/mock-db";

vi.mock("@/lib/db", async () => {
  const mockDb = await import("@/lib/mock-db");
  const asyncDb = await import("@/lib/db/mock-async");
  return { db: asyncDb.wrapMockDb(mockDb.db) };
});

vi.mock("@/lib/require-admin", () => ({
  requireAdmin: async () => null
}));

vi.mock("@/lib/revalidate-public", () => ({
  revalidatePublicSite: () => undefined
}));

beforeEach(() => {
  resetMockDb();
});
