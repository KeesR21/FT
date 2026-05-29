import { isValid, parseISO } from "date-fns";
import { sessionSquads } from "@/lib/weekly-schedule/labels";
import type { ScheduleSession, ScheduleSessionInput } from "@/lib/weekly-schedule/types";

export type SessionConflict = {
  sessionId: string;
  reason: string;
};

function window(isoStart: string, isoEnd: string) {
  const s = parseISO(isoStart);
  const e = parseISO(isoEnd);
  if (!isValid(s) || !isValid(e)) return null;
  return { start: s.getTime(), end: e.getTime() };
}

function overlaps(a: { start: number; end: number }, b: { start: number; end: number }) {
  return a.start < b.end && b.start < a.end;
}

function squadsOverlap(a: ScheduleSessionInput, b: ScheduleSessionInput): boolean {
  const ga = new Set(sessionSquads(a));
  const gb = sessionSquads(b);
  return gb.some((g) => ga.has(g));
}

export function findSessionConflicts(
  existing: ScheduleSession[],
  candidate: ScheduleSessionInput & { id?: string },
  excludeId?: string
): SessionConflict[] {
  const win = window(candidate.startsAt, candidate.endsAt);
  if (!win) return [{ sessionId: "", reason: "Invalid session times." }];

  const out: SessionConflict[] = [];
  for (const other of existing) {
    if (excludeId && other.id === excludeId) continue;
    const ow = window(other.startsAt, other.endsAt);
    if (!ow || !overlaps(win, ow)) continue;

    if (squadsOverlap(candidate, other)) {
      out.push({
        sessionId: other.id,
        reason: "Squad overlap with another session at this time."
      });
    } else if (candidate.pitchId === other.pitchId) {
      out.push({
        sessionId: other.id,
        reason: "Pitch conflict: same pitch booked at this time."
      });
    }
  }
  return out;
}
