import { isValid, parseISO } from "date-fns";
import type { ScheduleSession, ScheduleSessionInput } from "@/lib/weekly-schedule/types";

export type SessionConflict = {
  sessionId: string;
  reason: string;
};

function validTimes(isoStart: string, isoEnd: string): boolean {
  const s = parseISO(isoStart);
  const e = parseISO(isoEnd);
  return isValid(s) && isValid(e);
}

/**
 * Overlapping sessions are fully allowed: a pitch is treated as a shared
 * resource, so multiple squads may train or play at the same time on the same
 * pitch. The only thing reported here is structurally invalid session times.
 */
export function findSessionConflicts(
  _existing: ScheduleSession[],
  candidate: ScheduleSessionInput & { id?: string },
  _excludeId?: string
): SessionConflict[] {
  if (!validTimes(candidate.startsAt, candidate.endsAt)) {
    return [{ sessionId: "", reason: "Invalid session times." }];
  }
  return [];
}
