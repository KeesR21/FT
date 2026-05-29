import { format, isValid, parseISO } from "date-fns";
import { sortAgeGroups } from "@/lib/age-groups";
import type { AgeGroup } from "@/lib/age-groups";
import type { ScheduleSession, ScheduleSessionInput, ScheduleSessionType } from "@/lib/weekly-schedule/types";

export const PUBLIC_SCHEDULE_TITLE = "Weekly Schedule";

export function formatUpdatedOn(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = parseISO(iso);
  if (!isValid(d)) return null;
  return format(d, "d MMM yyyy");
}

export function periodLabel(period: "morning" | "afternoon"): string {
  return period === "morning" ? "Morning" : "Afternoon";
}

export function sessionTypeLabel(type: ScheduleSessionType): string {
  if (type === "match") return "Match Day";
  if (type === "rest") return "Rest";
  return "Training";
}

/** Squads involved in conflict detection (groups + match teams). */
export function sessionSquads(
  session: Pick<ScheduleSessionInput, "type" | "ageGroups" | "teamA" | "teamB">
): string[] {
  const squads = new Set<string>();
  for (const g of session.ageGroups ?? []) {
    if (g.trim()) squads.add(g.trim());
  }
  if (session.type === "match") {
    if (session.teamA?.trim()) squads.add(session.teamA.trim());
    if (session.teamB?.trim()) squads.add(session.teamB.trim());
  }
  return [...squads];
}

export function normalizeSessionInput(
  partial: Partial<ScheduleSessionInput> & Pick<ScheduleSessionInput, "startsAt" | "endsAt" | "pitchId">
): ScheduleSessionInput {
  const type: ScheduleSessionType = partial.type ?? "training";
  return {
    type,
    startsAt: partial.startsAt,
    endsAt: partial.endsAt,
    pitchId: partial.pitchId,
    coachIds: [...(partial.coachIds ?? [])],
    ageGroups: sortAgeGroups(partial.ageGroups ?? []) as AgeGroup[],
    period: partial.period ?? "afternoon",
    trainingTopic: partial.trainingTopic?.trim() ?? "",
    objectives: partial.objectives?.trim() ?? "",
    kit: partial.kit?.trim() ?? "",
    teamA: partial.teamA?.trim() ?? "",
    teamB: partial.teamB?.trim() ?? "",
    matchNotes: partial.matchNotes?.trim() ?? ""
  };
}

export function normalizeStoredSession(
  partial: Partial<ScheduleSession> & Pick<ScheduleSession, "id" | "versionId" | "startsAt" | "endsAt"> & {
    pitchId?: string;
  }
): ScheduleSession {
  const base = normalizeSessionInput({
    ...partial,
    pitchId: partial.pitchId ?? ""
  });
  return {
    id: partial.id,
    versionId: partial.versionId,
    ...base
  };
}
