import { addDays, endOfWeek, format, isMonday, isValid, parseISO, startOfWeek } from "date-fns";

export function assertMondayDate(weekStart: string): boolean {
  const d = parseISO(`${weekStart}T12:00:00`);
  return isValid(d) && isMonday(d);
}

export function weekStartFromDate(d: Date): string {
  const mon = startOfWeek(d, { weekStartsOn: 1 });
  return format(mon, "yyyy-MM-dd");
}

export function weekRangeLabel(weekStart: string): string {
  const start = parseISO(`${weekStart}T12:00:00`);
  if (!isValid(start)) return weekStart;
  const end = endOfWeek(start, { weekStartsOn: 1 });
  return `${format(start, "EEE d MMM yyyy")} – ${format(end, "EEE d MMM yyyy")}`;
}

export function weekDateRange(weekStart: string): { start: Date; end: Date } | null {
  const start = parseISO(`${weekStart}T00:00:00`);
  if (!isValid(start) || !isMonday(start)) return null;
  const end = addDays(start, 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function sessionWithinWeek(weekStart: string, startsAt: string, endsAt: string): boolean {
  const range = weekDateRange(weekStart);
  if (!range) return false;
  const s = parseISO(startsAt);
  const e = parseISO(endsAt);
  if (!isValid(s) || !isValid(e)) return false;
  return s >= range.start && e <= range.end;
}
