import type { CSSProperties } from "react";
import { sortAgeGroups } from "@/lib/age-groups";
import { ageGroupColor } from "@/lib/timetable-session";

type Props = {
  groups: readonly string[];
  className?: string;
};

/** Age-group tags in stable academy order (U7 → U18). */
export function SessionGroupTags({ groups, className }: Props) {
  const sorted = sortAgeGroups(groups);
  if (!sorted.length) return null;

  return (
    <div className={className ?? "ws-session-popup__groups"} role="list" aria-label="Age groups">
      {sorted.map((g) => {
        const c = ageGroupColor(g);
        return (
          <span
            key={g}
            role="listitem"
            className="ws-session-popup__chip"
            style={
              {
                borderColor: c.border,
                background: c.bg,
                color: c.text
              } as CSSProperties
            }
          >
            {g}
          </span>
        );
      })}
    </div>
  );
}

/** Sorted groups as a single line (titles, list cards). */
export function sessionGroupsDisplayLine(groups: readonly string[]): string {
  return sortAgeGroups(groups).join(" · ");
}
