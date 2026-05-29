import type { SessionKind, TimetableSession } from "@/lib/types";

export type TimetableSessionInput = Omit<TimetableSession, "id">;

/** Theme-aligned accent colors per age group (public calendar + admin chips). */
export const AGE_GROUP_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  U7: { bg: "rgba(0, 170, 255, 0.14)", border: "rgba(0, 170, 255, 0.45)", text: "#7dd3fc" },
  U9: { bg: "rgba(16, 185, 129, 0.14)", border: "rgba(16, 185, 129, 0.45)", text: "#6ee7b7" },
  U11: { bg: "rgba(139, 92, 246, 0.14)", border: "rgba(139, 92, 246, 0.45)", text: "#c4b5fd" },
  U14A: { bg: "rgba(245, 158, 11, 0.14)", border: "rgba(245, 158, 11, 0.45)", text: "#fcd34d" },
  U14B: { bg: "rgba(255, 0, 216, 0.12)", border: "rgba(255, 0, 216, 0.4)", text: "#f9a8d4" },
  U16: { bg: "rgba(34, 211, 238, 0.12)", border: "rgba(34, 211, 238, 0.4)", text: "#67e8f9" },
  U18: { bg: "rgba(251, 146, 60, 0.14)", border: "rgba(251, 146, 60, 0.45)", text: "#fdba74" }
};

const DEFAULT_GROUP_COLOR = {
  bg: "rgba(0, 170, 255, 0.12)",
  border: "rgba(0, 170, 255, 0.35)",
  text: "var(--ks-accent)"
};

export function ageGroupColor(group: string) {
  return AGE_GROUP_COLORS[group] ?? DEFAULT_GROUP_COLOR;
}

export function parseStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      const j = JSON.parse(raw) as unknown;
      if (Array.isArray(j)) return j.map((x) => String(x).trim()).filter(Boolean);
    } catch {
      return raw
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
}

/** Normalize legacy rows and API payloads into a consistent session shape. */
export function normalizeTimetableSession(
  partial: Partial<TimetableSession> & Pick<TimetableSession, "startsAt" | "endsAt">
): TimetableSession {
  const ageGroupsRaw = partial.ageGroups?.length
    ? partial.ageGroups
    : partial.ageGroup
      ? [partial.ageGroup]
      : [];
  const ageGroups = [...new Set(ageGroupsRaw.map((g) => g.trim()).filter(Boolean))];
  const ageGroup = ageGroups[0] ?? partial.ageGroup?.trim() ?? "U9";

  return {
    id: partial.id ?? "",
    title: partial.title?.trim() ?? "",
    ageGroup,
    ageGroups: ageGroups.length ? ageGroups : [ageGroup],
    kind: partial.kind ?? "training",
    startsAt: partial.startsAt,
    endsAt: partial.endsAt,
    locationName: partial.locationName?.trim() ?? "",
    kitRequirements: partial.kitRequirements?.trim() ?? "",
    trainerName: partial.trainerName?.trim() ?? "",
    activities: (partial.activities ?? []).map((a) => a.trim()).filter(Boolean),
    sessionObjectives: partial.sessionObjectives?.trim() ?? "",
    equipmentNotes: partial.equipmentNotes?.trim() ?? "",
    instructorNotes: partial.instructorNotes?.trim() ?? "",
    isUpdated: partial.isUpdated ?? false,
    updatedAt: partial.updatedAt ?? null
  };
}

export function defaultSessionTitle(ageGroups: string[], kind: SessionKind): string {
  const label = ageGroups.length ? ageGroups.join(" · ") : "Session";
  return `${label} ${kind === "match" ? "Match" : "Training"}`;
}

export function sessionGroupsLabel(session: TimetableSession): string {
  return session.ageGroups.length ? session.ageGroups.join(" · ") : session.ageGroup;
}

export function sessionDurationMinutes(startsAt: string, endsAt: string): number {
  const a = new Date(startsAt).getTime();
  const b = new Date(endsAt).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  return Math.round((b - a) / 60_000);
}
