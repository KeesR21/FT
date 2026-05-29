export const AGE_GROUPS = ["U7", "U9", "U11", "U14A", "U14B", "U16", "U18"] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

export function isAgeGroup(s: string): s is AgeGroup {
  return (AGE_GROUPS as readonly string[]).includes(s);
}

const AGE_GROUP_ORDER = new Map<string, number>(AGE_GROUPS.map((g, i) => [g, i]));

/** Stable academy order (U7 → U18) for labels, chips, and exports. */
export function sortAgeGroups<T extends string>(groups: readonly T[]): T[] {
  return [...groups].sort((a, b) => {
    const ai = AGE_GROUP_ORDER.get(a) ?? 999;
    const bi = AGE_GROUP_ORDER.get(b) ?? 999;
    if (ai !== bi) return ai - bi;
    return a.localeCompare(b);
  });
}
