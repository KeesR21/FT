import { randomUUID } from "crypto";
import { addMinutes, setHours, setMinutes } from "date-fns";
import type { AgeGroup } from "@/lib/age-groups";
import { findSessionConflicts } from "@/lib/weekly-schedule/conflicts";
import {
  formatUpdatedOn,
  normalizeSessionInput,
  normalizeStoredSession,
  periodLabel,
  PUBLIC_SCHEDULE_TITLE,
  sessionTypeLabel
} from "@/lib/weekly-schedule/labels";
import type {
  AdminVersionDetail,
  AdminWeekSummary,
  PublicScheduleSession,
  PublicWeeklySchedule,
  ScheduleCoach,
  SchedulePitch,
  ScheduleSession,
  ScheduleSessionInput,
  ScheduleVersion,
  ScheduleWeek
} from "@/lib/weekly-schedule/types";
import { validateSessionInput } from "@/lib/weekly-schedule/validation";
import { schedulePersistSoon } from "@/lib/weekly-schedule/schedule-persist";
import { weeklyScheduleStore as store } from "@/lib/weekly-schedule/store-snapshot";
import { assertMondayDate, weekRangeLabel } from "@/lib/weekly-schedule/week-math";

function touchPersist() {
  schedulePersistSoon();
}

function now() {
  return new Date().toISOString();
}

function juneSlot(day: number, hour: number, minute: number, durationMin: number) {
  const start = setMinutes(setHours(new Date(2026, 5, day), hour), minute);
  const end = addMinutes(start, durationMin);
  return { startsAt: start.toISOString(), endsAt: end.toISOString() };
}

export function seedWeeklyScheduleDefaults() {
  const s = store();
  if (s.seeded) return;
  const t = now();

  // Coaches are not seeded here — they are populated via syncTeamCoaches()
  // which reads from the /our-team CMS page on first API call.
  const coaches: ScheduleCoach[] = [];
  const pitches: SchedulePitch[] = [
    { id: "pitch-1", name: "Main Academy Pitch", active: true, createdAt: t, updatedAt: t },
    { id: "pitch-2", name: "Lion Arena", active: true, createdAt: t, updatedAt: t },
    { id: "pitch-3", name: "Regional Stadium", active: true, createdAt: t, updatedAt: t },
    { id: "pitch-4", name: "Training ground B", active: true, createdAt: t, updatedAt: t },
    { id: "pitch-5", name: "Indoor hall", active: true, createdAt: t, updatedAt: t }
  ];
  s.coaches.push(...coaches);
  s.pitches.push(...pitches);

  const weekStart = "2026-06-01";
  const week: ScheduleWeek = { id: "week-june-1", weekStart, createdAt: t };
  const version: ScheduleVersion = {
    id: "ver-june-1-v1",
    weekId: week.id,
    versionNumber: 1,
    status: "active",
    publishedAt: t,
    createdAt: t,
    updatedAt: t
  };
  s.weeks.push(week);
  s.versions.push(version);

  const sessions: Array<Omit<ScheduleSession, "id" | "versionId">> = [
    {
      type: "training",
      ...juneSlot(1, 16, 0, 60),
      ageGroups: ["U7"] as AgeGroup[],
      coachIds: ["tm-1"],
      pitchId: "pitch-1",
      period: "afternoon",
      trainingTopic: "Ball mastery & 1v1",
      objectives: "Close control in tight spaces.",
      kit: "Red kit, shin guards",
      teamA: "",
      teamB: "",
      matchNotes: ""
    },
    {
      type: "training",
      ...juneSlot(1, 17, 30, 90),
      ageGroups: ["U11"],
      coachIds: ["tm-2"],
      pitchId: "pitch-2",
      period: "afternoon",
      trainingTopic: "Wide overloads",
      objectives: "Switch play quickly.",
      kit: "Home kit",
      teamA: "",
      teamB: "",
      matchNotes: ""
    },
    {
      type: "training",
      ...juneSlot(2, 16, 0, 90),
      ageGroups: ["U9"],
      coachIds: ["tm-1"],
      pitchId: "pitch-1",
      period: "afternoon",
      trainingTopic: "Passing patterns",
      objectives: "First touch away from pressure.",
      kit: "Blue kit",
      teamA: "",
      teamB: "",
      matchNotes: ""
    },
    {
      type: "training",
      ...juneSlot(3, 18, 0, 90),
      ageGroups: ["U14A", "U14B"],
      coachIds: ["tm-2"],
      pitchId: "pitch-2",
      period: "afternoon",
      trainingTopic: "Pressing triggers",
      objectives: "Compact defending, fast transition.",
      kit: "Full kit",
      teamA: "",
      teamB: "",
      matchNotes: ""
    },
    {
      type: "training",
      ...juneSlot(4, 17, 0, 90),
      ageGroups: ["U16"],
      coachIds: ["tm-3"],
      pitchId: "pitch-4",
      period: "afternoon",
      trainingTopic: "Set-piece routines",
      objectives: "Organised defending from set plays.",
      kit: "Training top",
      teamA: "",
      teamB: "",
      matchNotes: ""
    },
    {
      type: "match",
      ...juneSlot(6, 10, 0, 90),
      ageGroups: ["U9"],
      coachIds: ["tm-1"],
      pitchId: "pitch-1",
      period: "morning",
      trainingTopic: "",
      objectives: "",
      kit: "",
      teamA: "U9",
      teamB: "Guest XI",
      matchNotes: "League fixture — arrive 45 minutes early."
    },
    {
      type: "match",
      ...juneSlot(6, 14, 0, 120),
      ageGroups: ["U18"],
      coachIds: ["tm-2", "tm-3"],
      pitchId: "pitch-2",
      period: "afternoon",
      trainingTopic: "",
      objectives: "",
      kit: "",
      teamA: "U18",
      teamB: "Academy Select",
      matchNotes: "Friendly — full kit required."
    },
    {
      type: "training",
      ...juneSlot(7, 9, 0, 75),
      ageGroups: ["U11"],
      coachIds: ["tm-2"],
      pitchId: "pitch-5",
      period: "morning",
      trainingTopic: "Futsal principles",
      objectives: "Tight control in smaller spaces.",
      kit: "Indoor shoes",
      teamA: "",
      teamB: "",
      matchNotes: ""
    }
  ];

  for (const sess of sessions) {
    s.sessions.push(
      normalizeStoredSession({
        id: randomUUID(),
        versionId: version.id,
        ...sess
      })
    );
  }

  s.seeded = true;
}


function getWeek(weekId: string) {
  return store().weeks.find((w) => w.id === weekId) ?? null;
}

function getVersion(versionId: string) {
  return store().versions.find((v) => v.id === versionId) ?? null;
}

function sessionsForVersion(versionId: string) {
  return store()
    .sessions.filter((s) => s.versionId === versionId)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

function activeVersionForWeek(weekId: string) {
  return (
    store().versions.find((v) => v.weekId === weekId && v.status === "active") ?? null
  );
}

function draftVersionForWeek(weekId: string) {
  return store().versions.find((v) => v.weekId === weekId && v.status === "draft") ?? null;
}

function enrichSession(
  session: ScheduleSession,
  coaches: ScheduleCoach[],
  pitches: SchedulePitch[]
): PublicScheduleSession {
  const normalized = normalizeStoredSession(session);
  const coachNames = normalized.coachIds
    .map((id) => coaches.find((c) => c.id === id)?.name)
    .filter(Boolean) as string[];
  const pitchName = pitches.find((p) => p.id === normalized.pitchId)?.name ?? "—";
  return {
    ...normalized,
    coachNames,
    pitchName,
    periodLabel: periodLabel(normalized.period),
    typeLabel: sessionTypeLabel(normalized.type)
  };
}

export const weeklyScheduleMock = {
  listCoaches(): ScheduleCoach[] {
    return [...store().coaches].sort((a, b) => a.name.localeCompare(b.name));
  },

  createCoach(input: { name: string }): ScheduleCoach {
    const t = now();
    const coach: ScheduleCoach = {
      id: randomUUID(),
      name: input.name.trim(),
      active: true,
      createdAt: t,
      updatedAt: t
    };
    store().coaches.push(coach);
    touchPersist();
    return coach;
  },

  updateCoach(id: string, patch: Partial<Pick<ScheduleCoach, "name" | "active">>): ScheduleCoach | null {
    const c = store().coaches.find((x) => x.id === id);
    if (!c) return null;
    if (patch.name !== undefined) c.name = patch.name.trim();
    if (patch.active !== undefined) c.active = patch.active;
    c.updatedAt = now();
    touchPersist();
    return c;
  },

  listPitches(): SchedulePitch[] {
    return [...store().pitches].sort((a, b) => a.name.localeCompare(b.name));
  },

  createPitch(input: { name: string }): SchedulePitch {
    const t = now();
    const pitch: SchedulePitch = {
      id: randomUUID(),
      name: input.name.trim(),
      active: true,
      createdAt: t,
      updatedAt: t
    };
    store().pitches.push(pitch);
    touchPersist();
    return pitch;
  },

  updatePitch(id: string, patch: Partial<Pick<SchedulePitch, "name" | "active">>): SchedulePitch | null {
    const p = store().pitches.find((x) => x.id === id);
    if (!p) return null;
    if (patch.name !== undefined) p.name = patch.name.trim();
    if (patch.active !== undefined) p.active = patch.active;
    p.updatedAt = now();
    touchPersist();
    return p;
  },

  listWeeksAdmin(): AdminWeekSummary[] {
    return store()
      .weeks.sort((a, b) => b.weekStart.localeCompare(a.weekStart))
      .map((week) => {
        const versions = store()
          .versions.filter((v) => v.weekId === week.id)
          .sort((a, b) => b.versionNumber - a.versionNumber);
        const active = versions.find((v) => v.status === "active") ?? null;
        const draft = versions.find((v) => v.status === "draft") ?? null;
        return {
          week,
          weekRangeLabel: weekRangeLabel(week.weekStart),
          activeVersion: active,
          updatedOnLabel: formatUpdatedOn(active?.updatedAt ?? active?.publishedAt),
          draftVersion: draft,
          hasUnpublishedDraft: Boolean(draft)
        };
      });
  },

  getWeekByStart(weekStart: string): ScheduleWeek | null {
    return store().weeks.find((w) => w.weekStart === weekStart) ?? null;
  },

  createWeek(weekStart: string): { week: ScheduleWeek; version: ScheduleVersion } {
    if (!assertMondayDate(weekStart)) {
      throw new Error("Week must start on a Monday (yyyy-MM-dd).");
    }
    if (store().weeks.some((w) => w.weekStart === weekStart)) {
      throw new Error("A schedule for this week already exists.");
    }
    const t = now();
    const week: ScheduleWeek = { id: randomUUID(), weekStart, createdAt: t };
    const version: ScheduleVersion = {
      id: randomUUID(),
      weekId: week.id,
      versionNumber: 1,
      status: "draft",
      publishedAt: null,
      createdAt: t,
      updatedAt: t
    };
    store().weeks.push(week);
    store().versions.push(version);
    touchPersist();
    return { week, version };
  },

  getVersionDetail(versionId: string): AdminVersionDetail | null {
    const version = getVersion(versionId);
    if (!version) return null;
    const week = getWeek(version.weekId);
    if (!week) return null;
    return {
      week,
      version,
      weekRangeLabel: weekRangeLabel(week.weekStart),
      updatedOnLabel: formatUpdatedOn(version.updatedAt) ?? "—",
      isEditable: version.status === "draft",
      isDraft: version.status === "draft",
      sessions: sessionsForVersion(versionId).map((s) => normalizeStoredSession(s)),
      coaches: this.listCoaches().filter((c) => c.active),
      pitches: this.listPitches().filter((p) => p.active)
    };
  },

  listPublishedWeekStarts(): string[] {
    return store()
      .weeks.filter((w) => activeVersionForWeek(w.id))
      .map((w) => w.weekStart)
      .sort((a, b) => a.localeCompare(b));
  },

  getPublicSchedule(weekStart?: string): PublicWeeklySchedule | null {
    let week: ScheduleWeek | null = null;
    if (weekStart) {
      week = store().weeks.find((w) => w.weekStart === weekStart) ?? null;
    } else {
      // Pick the most appropriate week based on today's real calendar date
      const todayStr = new Date().toISOString().slice(0, 10);
      const activeWeeks = store().weeks.filter((w) => activeVersionForWeek(w.id));
      const sorted = [...activeWeeks].sort((a, b) => a.weekStart.localeCompare(b.weekStart));

      // 1. Current week whose range contains today
      week =
        sorted.find((w) => {
          const wEnd = new Date(w.weekStart);
          wEnd.setDate(wEnd.getDate() + 6);
          return w.weekStart <= todayStr && wEnd.toISOString().slice(0, 10) >= todayStr;
        }) ?? null;

      if (!week) {
        // 2. Most recent past published week
        const past = sorted.filter((w) => {
          const wEnd = new Date(w.weekStart);
          wEnd.setDate(wEnd.getDate() + 6);
          return wEnd.toISOString().slice(0, 10) < todayStr;
        });
        week = past[past.length - 1] ?? null;
      }

      if (!week) {
        // 3. Next upcoming published week
        week = sorted.find((w) => w.weekStart > todayStr) ?? null;
      }

      if (!week) {
        // 4. Any published week as a last resort
        week = sorted[0] ?? null;
      }
    }
    if (!week) return null;
    const version = activeVersionForWeek(week.id);
    if (!version) return null;

    const coaches = this.listCoaches().filter((c) => c.active);
    const pitches = this.listPitches().filter((p) => p.active);
    const allSessions = sessionsForVersion(version.id).map((s) => enrichSession(s, coaches, pitches));

    // For the current ongoing week, strip sessions that have already ended so
    // the public page only shows remaining / upcoming sessions.
    const nowMs = Date.now();
    const todayStr = new Date().toISOString().slice(0, 10);
    const weekEndStr = (() => {
      const d = new Date(week.weekStart);
      d.setDate(d.getDate() + 6);
      return d.toISOString().slice(0, 10);
    })();
    const isCurrentWeek = week.weekStart <= todayStr && weekEndStr >= todayStr;
    const sessions = isCurrentWeek
      ? allSessions.filter((s) => new Date(s.endsAt).getTime() > nowMs)
      : allSessions;

    const updatedOnLabel = formatUpdatedOn(version.updatedAt);

    return {
      week,
      version,
      weekRangeLabel: weekRangeLabel(week.weekStart),
      title: PUBLIC_SCHEDULE_TITLE,
      updatedOnLabel: updatedOnLabel ?? "—",
      sessions,
      coaches,
      pitches
    };
  },

  addSession(versionId: string, input: ScheduleSessionInput): ScheduleSession {
    const version = getVersion(versionId);
    if (!version) throw new Error("Version not found.");
    if (version.status !== "draft") {
      throw new Error("Only draft schedules can be edited. Create an update to change a published week.");
    }
    const week = getWeek(version.weekId);
    if (!week) throw new Error("Week not found.");

    const coaches = this.listCoaches();
    const pitches = this.listPitches();
    const normalized = normalizeSessionInput(input);
    const v = validateSessionInput(week.weekStart, normalized, coaches, pitches);
    if (!v.ok) throw new Error(v.error);

    const existing = sessionsForVersion(versionId);
    const conflicts = findSessionConflicts(existing, normalized);
    if (conflicts.length) throw new Error(conflicts.map((c) => c.reason).join(" "));

    const session: ScheduleSession = {
      id: randomUUID(),
      versionId,
      ...normalized,
      ageGroups: [...normalized.ageGroups],
      coachIds: [...normalized.coachIds]
    };
    store().sessions.push(session);
    version.updatedAt = now();
    touchPersist();
    return session;
  },

  updateSession(
    versionId: string,
    sessionId: string,
    input: ScheduleSessionInput
  ): ScheduleSession {
    const version = getVersion(versionId);
    if (!version || version.status !== "draft") {
      throw new Error("Only draft schedules can be edited.");
    }
    const week = getWeek(version.weekId);
    if (!week) throw new Error("Week not found.");

    const idx = store().sessions.findIndex((s) => s.id === sessionId && s.versionId === versionId);
    if (idx < 0) throw new Error("Session not found.");

    const coaches = this.listCoaches();
    const pitches = this.listPitches();
    const normalized = normalizeSessionInput(input);
    const v = validateSessionInput(week.weekStart, normalized, coaches, pitches);
    if (!v.ok) throw new Error(v.error);

    const existing = sessionsForVersion(versionId);
    const conflicts = findSessionConflicts(existing, { ...normalized, id: sessionId }, sessionId);
    if (conflicts.length) throw new Error(conflicts.map((c) => c.reason).join(" "));

    const updated: ScheduleSession = {
      id: sessionId,
      versionId,
      ...normalized,
      ageGroups: [...normalized.ageGroups],
      coachIds: [...normalized.coachIds]
    };
    store().sessions[idx] = updated;
    version.updatedAt = now();
    touchPersist();
    return updated;
  },

  deleteSession(versionId: string, sessionId: string): boolean {
    const version = getVersion(versionId);
    if (!version || version.status !== "draft") {
      throw new Error("Only draft schedules can be edited.");
    }
    const before = store().sessions.length;
    store().sessions = store().sessions.filter(
      (s) => !(s.id === sessionId && s.versionId === versionId)
    );
    if (store().sessions.length < before) {
      version.updatedAt = now();
      touchPersist();
      return true;
    }
    return false;
  },

  publishVersion(versionId: string): ScheduleVersion {
    const version = getVersion(versionId);
    if (!version) throw new Error("Version not found.");
    if (version.status !== "draft") throw new Error("Only draft versions can be published.");

    const week = getWeek(version.weekId);
    if (!week) throw new Error("Week not found.");

    const sessions = sessionsForVersion(versionId);
    if (!sessions.length) throw new Error("Add at least one session before publishing.");

    const coaches = this.listCoaches();
    const pitches = this.listPitches();
    for (const s of sessions) {
      const normalized = normalizeStoredSession(s);
      const v = validateSessionInput(week.weekStart, normalized, coaches, pitches);
      if (!v.ok) throw new Error(v.error);
    }

    const conflicts: string[] = [];
    for (const s of sessions) {
      const normalized = normalizeStoredSession(s);
      const c = findSessionConflicts(sessions, normalized, s.id);
      conflicts.push(...c.map((x) => x.reason));
    }
    if (conflicts.length) throw new Error(conflicts[0]);

    const prevActive = activeVersionForWeek(version.weekId);
    if (prevActive && prevActive.id !== versionId) {
      prevActive.status = "superseded";
      prevActive.updatedAt = now();
    }

    version.status = "active";
    version.publishedAt = now();
    version.updatedAt = now();
    touchPersist();
    return version;
  },

  createUpdateVersion(weekId: string): ScheduleVersion {
    const week = getWeek(weekId);
    if (!week) throw new Error("Week not found.");

    if (draftVersionForWeek(weekId)) {
      throw new Error("A draft update already exists for this week. Publish or discard it first.");
    }

    const active = activeVersionForWeek(weekId);
    if (!active) throw new Error("No published schedule to update. Publish the initial week first.");

    const t = now();
    const nextNum =
      Math.max(0, ...store().versions.filter((v) => v.weekId === weekId).map((v) => v.versionNumber)) + 1;

    const draft: ScheduleVersion = {
      id: randomUUID(),
      weekId,
      versionNumber: nextNum,
      status: "draft",
      publishedAt: null,
      createdAt: t,
      updatedAt: t
    };
    store().versions.push(draft);

    for (const sess of sessionsForVersion(active.id)) {
      store().sessions.push(
        normalizeStoredSession({
          ...sess,
          id: randomUUID(),
          versionId: draft.id
        })
      );
    }
    touchPersist();
    return draft;
  },

  /**
   * Sync the schedule-coach store with the current `/our-team` members.
   * Call this at the start of any API route that reads or validates coaches.
   * Coaches removed from the team page are marked inactive; new members are added.
   */
  syncTeamCoaches(members: { id: string; name: string }[]): void {
    const t = now();
    const memberIds = new Set(members.map((m) => m.id));

    // Upsert each team member
    for (const m of members) {
      const existing = store().coaches.find((c) => c.id === m.id);
      if (existing) {
        existing.name = m.name;
        existing.active = true;
        existing.updatedAt = t;
      } else {
        store().coaches.push({ id: m.id, name: m.name, active: true, createdAt: t, updatedAt: t });
      }
    }

    // Deactivate coaches no longer on the team page
    for (const coach of store().coaches) {
      if (!memberIds.has(coach.id)) {
        coach.active = false;
        coach.updatedAt = t;
      }
    }
    touchPersist();
  },

  discardDraft(versionId: string): boolean {
    const version = getVersion(versionId);
    if (!version || version.status !== "draft") return false;
    if (version.versionNumber === 1 && !activeVersionForWeek(version.weekId)) {
      throw new Error("Cannot discard the only draft for a new week.");
    }
    store().sessions = store().sessions.filter((s) => s.versionId !== versionId);
    store().versions = store().versions.filter((v) => v.id !== versionId);
    touchPersist();
    return true;
  },

  deleteWeek(weekId: string): boolean {
    const week = getWeek(weekId);
    if (!week) return false;
    const versionIds = store().versions.filter((v) => v.weekId === weekId).map((v) => v.id);
    store().sessions = store().sessions.filter((s) => !versionIds.includes(s.versionId));
    store().versions = store().versions.filter((v) => v.weekId !== weekId);
    store().weeks = store().weeks.filter((w) => w.id !== weekId);
    touchPersist();
    return true;
  }
};

export type WeeklyScheduleStore = typeof weeklyScheduleMock;
