import { differenceInMinutes, isValid, parseISO } from "date-fns";
import { isAgeGroup } from "@/lib/age-groups";
import type { ScheduleCoach, SchedulePitch, ScheduleSessionInput } from "@/lib/weekly-schedule/types";
import { normalizeSessionInput } from "@/lib/weekly-schedule/labels";
import { sessionWithinWeek } from "@/lib/weekly-schedule/week-math";

export type ValidationResult = { ok: true } | { ok: false; error: string };

export function validateSessionInput(
  weekStart: string,
  input: ScheduleSessionInput,
  coaches: ScheduleCoach[],
  pitches: SchedulePitch[]
): ValidationResult {
  const data = normalizeSessionInput(input);
  const start = parseISO(data.startsAt);
  const end = parseISO(data.endsAt);
  if (!isValid(start) || !isValid(end)) {
    return { ok: false, error: "Invalid session start or end time." };
  }
  if (end <= start) {
    return { ok: false, error: "End time must be after start time." };
  }
  if (start < new Date()) {
    return {
      ok: false,
      error:
        "Cannot schedule sessions in the past. Select a future date and time."
    };
  }
  const mins = differenceInMinutes(end, start);
  if (mins < 30) return { ok: false, error: "Sessions must be at least 30 minutes." };
  if (mins > 300) return { ok: false, error: "Sessions cannot exceed 5 hours." };
  if (!sessionWithinWeek(weekStart, data.startsAt, data.endsAt)) {
    return { ok: false, error: "Session must fall within the selected week (Monday–Sunday)." };
  }

  if (!data.pitchId?.trim()) {
    return { ok: false, error: "Select a pitch." };
  }
  const pitch = pitches.find((p) => p.id === data.pitchId && p.active);
  if (!pitch) return { ok: false, error: "Selected pitch is invalid or inactive." };

  const activeCoachIds = new Set(coaches.filter((c) => c.active).map((c) => c.id));
  for (const id of data.coachIds) {
    if (!activeCoachIds.has(id)) {
      return { ok: false, error: "One or more coaches are invalid or inactive." };
    }
  }

  if (data.type === "training") {
    if (!data.ageGroups?.length) {
      return { ok: false, error: "Select at least one group." };
    }
    for (const g of data.ageGroups) {
      if (!isAgeGroup(g)) return { ok: false, error: `Invalid group: ${g}` };
    }
    if (!data.coachIds.length) {
      return { ok: false, error: "Select at least one coach." };
    }
    if (data.period !== "morning" && data.period !== "afternoon") {
      return { ok: false, error: "Select Morning or Afternoon." };
    }
    return { ok: true };
  }

  if (data.type === "rest") {
    for (const g of data.ageGroups) {
      if (!isAgeGroup(g)) return { ok: false, error: `Invalid group: ${g}` };
    }
    return { ok: true };
  }

  if (!data.teamA?.trim() || !data.teamB?.trim()) {
    return { ok: false, error: "Select both teams for the match." };
  }
  if (data.teamA.trim().toLowerCase() === data.teamB.trim().toLowerCase()) {
    return { ok: false, error: "Team A and Team B must be different." };
  }
  for (const g of data.ageGroups) {
    if (!isAgeGroup(g)) return { ok: false, error: `Invalid group: ${g}` };
  }
  return { ok: true };
}
