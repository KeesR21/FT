import { isValid, parseISO } from "date-fns";
import type { TimetableSession } from "@/lib/types";

export type ScheduleConflict = {
  sessionId: string;
  title: string;
  reason: string;
};

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function sessionWindow(s: TimetableSession): { start: number; end: number } | null {
  const start = parseISO(s.startsAt);
  const end = parseISO(s.endsAt);
  if (!isValid(start) || !isValid(end)) return null;
  return { start: start.getTime(), end: end.getTime() };
}

function groupsOverlap(a: TimetableSession, b: TimetableSession): boolean {
  const ga = new Set(a.ageGroups.length ? a.ageGroups : [a.ageGroup]);
  const gb = new Set(b.ageGroups.length ? b.ageGroups : [b.ageGroup]);
  for (const g of ga) {
    if (gb.has(g)) return true;
  }
  return false;
}

/**
 * Detect scheduling conflicts for a candidate session against existing sessions.
 * Flags overlapping time for the same age group(s) or same location.
 */
export function findScheduleConflicts(
  existing: TimetableSession[],
  candidate: Pick<TimetableSession, "id" | "startsAt" | "endsAt" | "ageGroup" | "ageGroups" | "locationName">,
  options?: { excludeId?: string }
): ScheduleConflict[] {
  const win = sessionWindow(candidate as TimetableSession);
  if (!win) return [{ sessionId: "", title: "", reason: "Invalid session times." }];

  const conflicts: ScheduleConflict[] = [];
  const loc = candidate.locationName.trim().toLowerCase();

  for (const other of existing) {
    if (options?.excludeId && other.id === options.excludeId) continue;
    const ow = sessionWindow(other);
    if (!ow || !overlaps(win.start, win.end, ow.start, ow.end)) continue;

    const sameLocation =
      loc.length > 0 && other.locationName.trim().toLowerCase() === loc;
    const sameGroup = groupsOverlap(candidate as TimetableSession, other);

    if (sameGroup) {
      conflicts.push({
        sessionId: other.id,
        title: other.title,
        reason: `Overlaps with ${other.title} (${other.ageGroup}) for a shared squad.`
      });
    } else if (sameLocation) {
      conflicts.push({
        sessionId: other.id,
        title: other.title,
        reason: `Overlaps with ${other.title} at the same location (${other.locationName}).`
      });
    }
  }

  return conflicts;
}
