import type { TimetableSessionBody } from "@/lib/timetable-api-schema";
import { defaultSessionTitle, normalizeTimetableSession } from "@/lib/timetable-session";
import type { TimetableSession } from "@/lib/types";

export function patchToSessionFields(
  patch: Partial<TimetableSessionBody>,
  existing: TimetableSession
): Omit<TimetableSession, "id"> {
  return bodyToSessionFields(
    {
      kind: patch.kind ?? existing.kind,
      startsAt: patch.startsAt ?? existing.startsAt,
      endsAt: patch.endsAt ?? existing.endsAt,
      locationName: patch.locationName ?? existing.locationName,
      title: patch.title,
      ageGroup: patch.ageGroup,
      ageGroups: patch.ageGroups,
      kitRequirements: patch.kitRequirements,
      trainerName: patch.trainerName,
      activities: patch.activities,
      sessionObjectives: patch.sessionObjectives,
      equipmentNotes: patch.equipmentNotes,
      instructorNotes: patch.instructorNotes
    },
    existing
  );
}

export function bodyToSessionFields(
  data: TimetableSessionBody,
  existing?: Partial<TimetableSession>
): Omit<TimetableSession, "id"> {
  const ageGroups =
    data.ageGroups?.length ? data.ageGroups : data.ageGroup ? [data.ageGroup] : existing?.ageGroups ?? ["U9"];
  const kind = data.kind ?? existing?.kind ?? "training";
  const title = data.title?.trim() || defaultSessionTitle(ageGroups, kind);

  return normalizeTimetableSession({
    title,
    ageGroup: ageGroups[0]!,
    ageGroups,
    kind,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    locationName: data.locationName,
    kitRequirements: data.kitRequirements ?? existing?.kitRequirements ?? "",
    trainerName: data.trainerName ?? existing?.trainerName ?? "",
    activities: data.activities ?? existing?.activities ?? [],
    sessionObjectives: data.sessionObjectives ?? existing?.sessionObjectives ?? "",
    equipmentNotes: data.equipmentNotes ?? existing?.equipmentNotes ?? "",
    instructorNotes: data.instructorNotes ?? existing?.instructorNotes ?? "",
    isUpdated: existing?.isUpdated ?? false,
    updatedAt: existing?.updatedAt ?? null
  });
}
