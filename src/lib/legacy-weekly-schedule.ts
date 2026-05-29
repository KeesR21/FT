import { endOfWeek, format, isValid, isWithinInterval, parseISO, startOfWeek } from "date-fns";
import type { TimetableSession } from "@/lib/types";

/** Matches the prompt’s shape; keys are full English weekday names. */
export type WeeklyCalendarEvent = {
  title: string;
  /** Combined range for compact display */
  time: string;
  startTime: string;
  endTime: string;
  location?: string;
  isUpdated?: boolean;
  updatedAt?: string | null;
};

export const WEEKDAY_ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday"
] as const;

export type WeekdayName = (typeof WEEKDAY_ORDER)[number];

export type WeekScheduleByDay = Record<WeekdayName, WeeklyCalendarEvent[]>;

function emptyWeek(): WeekScheduleByDay {
  return {
    Monday: [],
    Tuesday: [],
    Wednesday: [],
    Thursday: [],
    Friday: [],
    Saturday: [],
    Sunday: []
  };
}

function isWeekdayName(s: string): s is WeekdayName {
  return (WEEKDAY_ORDER as readonly string[]).includes(s);
}

/**
 * Groups timetable sessions into Mon–Sun buckets for the calendar week containing `anchor`.
 * Pass sessions sorted by `startsAt` for chronological order within each day.
 */
export function sessionsToWeekSchedule(
  sessions: TimetableSession[],
  anchor: Date = new Date()
): {
  scheduleByDay: WeekScheduleByDay;
  weekRangeLabel: string;
  defaultSelectedDay: WeekdayName;
} {
  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(anchor, { weekStartsOn: 1 });
  const scheduleByDay = emptyWeek();

  for (const s of sessions) {
    const d = parseISO(s.startsAt);
    if (!isValid(d) || !isWithinInterval(d, { start: weekStart, end: weekEnd })) continue;
    const day = format(d, "EEEE");
    if (!isWeekdayName(day)) continue;
    const end = parseISO(s.endsAt);
    const startLabel = format(d, "h:mm a");
    const endLabel = isValid(end) ? format(end, "h:mm a") : "—";
    const timeStr = `${startLabel} – ${endLabel}`;
    scheduleByDay[day].push({
      title: s.title.trim() || `${s.ageGroup} ${s.kind === "match" ? "Match" : "Training"}`,
      time: timeStr,
      startTime: startLabel,
      endTime: endLabel,
      location: s.locationName,
      isUpdated: s.isUpdated,
      updatedAt: s.updatedAt
    });
  }

  const weekRangeLabel = `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`;

  let defaultSelectedDay: WeekdayName = "Monday";
  if (isWithinInterval(anchor, { start: weekStart, end: weekEnd })) {
    const todayName = format(anchor, "EEEE");
    if (isWeekdayName(todayName)) defaultSelectedDay = todayName;
  }

  return { scheduleByDay, weekRangeLabel, defaultSelectedDay };
}
