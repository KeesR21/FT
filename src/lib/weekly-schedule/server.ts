import { isDirectPostgresConfigured } from "@/lib/db/postgres-client";
import { weeklyScheduleMock } from "@/lib/weekly-schedule/mock-store";
import { ensureScheduleHydrated } from "@/lib/weekly-schedule/schedule-persist";

/** Versioned weekly schedule store (server / API routes only). */
export const weeklySchedule = weeklyScheduleMock;

let ready: Promise<void> | null = null;

/** Load timetable from MongoDB before reads/writes (no-op when using in-memory only). */
export function weeklyScheduleReady(): Promise<void> {
  if (!ready) ready = ensureScheduleHydrated();
  return ready;
}

export function isWeeklySchedulePostgresEnabled(): boolean {
  return isDirectPostgresConfigured();
}

export type { WeeklyScheduleStore } from "@/lib/weekly-schedule/mock-store";
