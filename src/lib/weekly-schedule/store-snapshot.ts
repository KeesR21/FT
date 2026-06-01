import type {
  ScheduleCoach,
  SchedulePitch,
  ScheduleSession,
  ScheduleVersion,
  ScheduleWeek
} from "@/lib/weekly-schedule/types";

export type WeeklyScheduleSnapshot = {
  coaches: ScheduleCoach[];
  pitches: SchedulePitch[];
  weeks: ScheduleWeek[];
  versions: ScheduleVersion[];
  sessions: ScheduleSession[];
  seeded: boolean;
};

const GLOBAL_KEY = "__ftprWeeklyScheduleStore";

type Store = WeeklyScheduleSnapshot;

function store(): Store {
  const g = globalThis as unknown as Record<string, Store | undefined>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = {
      coaches: [],
      pitches: [],
      weeks: [],
      versions: [],
      sessions: [],
      seeded: false
    };
  }
  return g[GLOBAL_KEY]!;
}

export function exportStoreSnapshot(): WeeklyScheduleSnapshot {
  const s = store();
  return {
    coaches: [...s.coaches],
    pitches: [...s.pitches],
    weeks: [...s.weeks],
    versions: [...s.versions],
    sessions: [...s.sessions],
    seeded: s.seeded
  };
}

export function applyStoreSnapshot(snapshot: WeeklyScheduleSnapshot): void {
  const s = store();
  s.coaches = [...snapshot.coaches];
  s.pitches = [...snapshot.pitches];
  s.weeks = [...snapshot.weeks];
  s.versions = [...snapshot.versions];
  s.sessions = [...snapshot.sessions];
  s.seeded = Boolean(snapshot.seeded);
}

export function runSeedDefaults(): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { seedWeeklyScheduleDefaults } = require("@/lib/weekly-schedule/mock-store") as {
    seedWeeklyScheduleDefaults: () => void;
  };
  seedWeeklyScheduleDefaults();
}

export { store as weeklyScheduleStore };
