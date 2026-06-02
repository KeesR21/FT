import { format, isValid, parseISO } from "date-fns";
import { sortAgeGroups } from "@/lib/age-groups";
import { academyDateKey } from "@/lib/weekly-schedule/academy-time";
import { weeklySchedule, weeklyScheduleReady } from "@/lib/weekly-schedule/server";
import type { PublicScheduleSession } from "@/lib/weekly-schedule/types";
import { weekDateRange } from "@/lib/weekly-schedule/week-math";

export type HomeScheduleBriefItem = {
  timeLabel: string;
  title: string;
  meta: string;
};

export type HomeScheduleBrief = {
  heading: string;
  dateLabel: string;
  /** Academy calendar day this brief represents (`yyyy-MM-dd`). */
  dayKey: string;
  items: HomeScheduleBriefItem[];
  isEmpty: boolean;
  emptyMessage: string;
};

function formatTimeRange(startsAt: string, endsAt: string): string {
  const start = parseISO(startsAt);
  const end = parseISO(endsAt);
  if (!isValid(start) || !isValid(end)) return "—";
  return `${format(start, "h:mm a")} – ${format(end, "h:mm a")}`;
}

function sessionBriefLines(session: PublicScheduleSession): { title: string; meta: string } {
  if (session.type === "match") {
    return {
      title: `${session.teamA} vs ${session.teamB}`,
      meta: [session.pitchName, session.typeLabel].filter(Boolean).join(" · ")
    };
  }
  if (session.type === "rest") {
    const groups = sortAgeGroups(session.ageGroups).join(", ");
    return {
      title: session.trainingTopic || "Rest",
      meta: [groups || "All groups", session.pitchName, session.periodLabel].filter(Boolean).join(" · ")
    };
  }
  const groups = sortAgeGroups(session.ageGroups).join(", ");
  return {
    title: groups || session.trainingTopic || "Training",
    meta: [session.pitchName, session.periodLabel].filter(Boolean).join(" · ")
  };
}

function sessionsOnDate(sessions: PublicScheduleSession[], dateKey: string): PublicScheduleSession[] {
  return sessions
    .filter((s) => {
      const d = parseISO(s.startsAt);
      if (!isValid(d)) return false;
      return academyDateKey(d) === dateKey;
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

function findPublishedScheduleForDate(dateKey: string) {
  const weekStarts = weeklySchedule.listPublishedWeekStarts();
  if (!weekStarts.length) return null;

  const target = parseISO(`${dateKey}T12:00:00`);
  if (isValid(target)) {
    for (let i = weekStarts.length - 1; i >= 0; i--) {
      const range = weekDateRange(weekStarts[i]!);
      if (range && target >= range.start && target <= range.end) {
        return weeklySchedule.getPublicSchedule(weekStarts[i]);
      }
    }
  }

  return weeklySchedule.getPublicSchedule(weekStarts[weekStarts.length - 1]);
}

/**
 * Brief list for the home hero card — always the academy calendar "today" (resets at 00:00 Kigali).
 */
const EMPTY_BRIEF = (dayKey: string, dateLabel: string): HomeScheduleBrief => ({
  heading: "Today's schedule",
  dateLabel,
  dayKey,
  items: [],
  isEmpty: true,
  emptyMessage: "No published sessions right now. Check the full weekly timetable."
});

export async function getHomeScheduleBrief(now: Date = new Date()): Promise<HomeScheduleBrief> {
  const dayKey = academyDateKey(now);
  const displayDate = parseISO(`${dayKey}T12:00:00`);
  const dateLabel = isValid(displayDate) ? format(displayDate, "EEE d MMM yyyy") : dayKey;

  try {
    await weeklyScheduleReady();
  } catch (err) {
    console.error("[getHomeScheduleBrief] schedule not ready:", err);
    return EMPTY_BRIEF(dayKey, dateLabel);
  }

  const schedule = findPublishedScheduleForDate(dayKey);

  if (!schedule || schedule.sessions.length === 0) {
    return {
      heading: "Today's schedule",
      dateLabel,
      dayKey,
      items: [],
      isEmpty: true,
      emptyMessage: "No published sessions right now. Check the full weekly timetable."
    };
  }

  const daySessions = sessionsOnDate(schedule.sessions, dayKey);

  if (daySessions.length === 0) {
    return {
      heading: "Today's schedule",
      dateLabel,
      dayKey,
      items: [],
      isEmpty: true,
      emptyMessage: "No sessions scheduled for today. See the full week for upcoming days."
    };
  }

  const items: HomeScheduleBriefItem[] = daySessions.map((session) => {
    const { title, meta } = sessionBriefLines(session);
    return {
      timeLabel: formatTimeRange(session.startsAt, session.endsAt),
      title,
      meta
    };
  });

  return {
    heading: "Today's schedule",
    dateLabel,
    dayKey,
    items,
    isEmpty: false,
    emptyMessage: ""
  };
}
