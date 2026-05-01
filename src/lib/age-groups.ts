export const AGE_GROUPS = ["U7", "U9", "U11", "U14A", "U14B", "U16", "U18"] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

export function isAgeGroup(s: string): s is AgeGroup {
  return (AGE_GROUPS as readonly string[]).includes(s);
}
