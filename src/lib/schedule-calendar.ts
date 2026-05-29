import {
  addDays,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek
} from "date-fns";
import type { TimetableSession } from "@/lib/types";

export type ScheduleDayCell = {
  date: Date;
  dateKey: string;
  inMonth: boolean;
  isToday: boolean;
  sessionCount: number;
};

export function dateKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function groupSessionsByDate(sessions: TimetableSession[]): Map<string, TimetableSession[]> {
  const map = new Map<string, TimetableSession[]>();
  for (const s of sessions) {
    const d = parseISO(s.startsAt);
    if (!isValid(d)) continue;
    const key = dateKey(d);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }
  return map;
}

export function buildMonthGrid(monthAnchor: Date, sessionsByDate: Map<string, TimetableSession[]>): ScheduleDayCell[] {
  const monthStart = startOfMonth(monthAnchor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const today = new Date();
  const cells: ScheduleDayCell[] = [];

  for (let i = 0; i < 42; i++) {
    const date = addDays(gridStart, i);
    const key = dateKey(date);
    cells.push({
      date,
      dateKey: key,
      inMonth: isSameMonth(date, monthAnchor),
      isToday: isSameDay(date, today),
      sessionCount: sessionsByDate.get(key)?.length ?? 0
    });
  }

  // Trim trailing empty week if entire row is outside month
  while (cells.length > 35 && cells.slice(-7).every((c) => !c.inMonth && c.sessionCount === 0)) {
    cells.splice(-7, 7);
  }

  return cells;
}

export function sessionsInWeek(
  sessions: TimetableSession[],
  weekStart: Date
): TimetableSession[] {
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  return sessions.filter((s) => {
    const d = parseISO(s.startsAt);
    return isValid(d) && d >= weekStart && d <= weekEnd;
  });
}

export function monthLabel(d: Date): string {
  return format(d, "MMMM yyyy");
}

export function weekRangeLabel(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  return `${format(weekStart, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
}
