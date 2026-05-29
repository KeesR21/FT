import { isDirectPostgresConfigured } from "@/lib/db/postgres-client";
import { weeklyScheduleMock } from "@/lib/weekly-schedule/mock-store";

/** Versioned weekly schedule store (server / API routes only). */
export const weeklySchedule = weeklyScheduleMock;

export function isWeeklySchedulePostgresEnabled(): boolean {
  return isDirectPostgresConfigured();
}

export type { WeeklyScheduleStore } from "@/lib/weekly-schedule/mock-store";
