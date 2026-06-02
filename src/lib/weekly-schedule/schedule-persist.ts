import { connectMongo } from "@/lib/db/mongo-client";
import { isMongoConfigured } from "@/lib/db/mongo-client";
import { ScheduleStateModel } from "@/lib/db/mongo-models";
import { applyStoreSnapshot, exportStoreSnapshot, runSeedDefaults } from "@/lib/weekly-schedule/store-snapshot";

const STATE_ID = "main";
let hydrated = false;
let hydratePromise: Promise<void> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export async function ensureScheduleHydrated(): Promise<void> {
  if (hydrated) return;
  if (!hydratePromise) hydratePromise = hydrateOnce();
  await hydratePromise;
}

async function hydrateOnce(): Promise<void> {
  if (!isMongoConfigured()) {
    runSeedDefaults();
    hydrated = true;
    return;
  }
  try {
    await connectMongo();
    const doc = await ScheduleStateModel.findById(STATE_ID).lean();
    const payload = doc ? (doc as { payload?: unknown }).payload : null;
    if (payload && typeof payload === "object") {
      applyStoreSnapshot(payload as Parameters<typeof applyStoreSnapshot>[0]);
    } else {
      runSeedDefaults();
      await persistScheduleStoreNow();
    }
  } catch (err) {
    console.error("[schedule] hydrate failed — using in-memory defaults:", err);
    runSeedDefaults();
  }
  hydrated = true;
}

export async function persistScheduleStoreNow(): Promise<void> {
  if (!isMongoConfigured()) return;
  await connectMongo();
  const payload = exportStoreSnapshot();
  await ScheduleStateModel.findByIdAndUpdate(
    STATE_ID,
    { $set: { payload, updated_at: new Date().toISOString() } },
    { upsert: true }
  );
}

export function schedulePersistSoon(): void {
  if (!isMongoConfigured()) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void persistScheduleStoreNow().catch((err) => {
      console.error("[schedule] persist failed:", err);
    });
  }, 400);
}
