import type { AgeGroup } from "@/lib/age-groups";

export type SchedulePeriod = "morning" | "afternoon";
export type ScheduleSessionType = "training" | "match" | "rest";

export type VersionDisplayLabel = "draft" | "published" | "updated" | "previous";

export type ScheduleVersionStatus = "draft" | "active" | "superseded";

export type ScheduleCoach = {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SchedulePitch = {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ScheduleWeek = {
  id: string;
  /** Monday of the week (yyyy-MM-dd). */
  weekStart: string;
  createdAt: string;
};

export type ScheduleVersion = {
  id: string;
  weekId: string;
  versionNumber: number;
  status: ScheduleVersionStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ScheduleSession = {
  id: string;
  versionId: string;
  type: ScheduleSessionType;
  startsAt: string;
  endsAt: string;
  pitchId: string;
  coachIds: string[];
  /** Training */
  ageGroups: AgeGroup[];
  period: SchedulePeriod;
  trainingTopic: string;
  objectives: string;
  kit: string;
  /** Match day */
  teamA: string;
  teamB: string;
  matchNotes: string;
};

export type ScheduleSessionInput = Omit<ScheduleSession, "id" | "versionId">;

export type PublicWeeklySchedule = {
  week: ScheduleWeek;
  version: ScheduleVersion;
  weekRangeLabel: string;
  /** Always "Weekly Schedule" on the public site. */
  title: string;
  /** e.g. "12 Feb 2026" */
  updatedOnLabel: string;
  sessions: PublicScheduleSession[];
  coaches: ScheduleCoach[];
  pitches: SchedulePitch[];
};

export type PublicScheduleSession = ScheduleSession & {
  coachNames: string[];
  pitchName: string;
  periodLabel: string;
  typeLabel: string;
  /** True when the session's end time is already in the past. Computed at read time; never stored. */
  completed: boolean;
};

export type AdminWeekSummary = {
  week: ScheduleWeek;
  weekRangeLabel: string;
  activeVersion: ScheduleVersion | null;
  updatedOnLabel: string | null;
  draftVersion: ScheduleVersion | null;
  hasUnpublishedDraft: boolean;
};

export type AdminVersionDetail = {
  week: ScheduleWeek;
  version: ScheduleVersion;
  weekRangeLabel: string;
  updatedOnLabel: string;
  isEditable: boolean;
  isDraft: boolean;
  sessions: ScheduleSession[];
  coaches: ScheduleCoach[];
  pitches: SchedulePitch[];
};
