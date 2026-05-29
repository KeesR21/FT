import { addDays, format, isValid, parseISO } from "date-fns";

/** Academy local time (Rwanda — no daylight saving). */
export const ACADEMY_TIMEZONE = "Africa/Kigali";

/** Fixed offset for Africa/Kigali (UTC+2). */
const ACADEMY_UTC_OFFSET = "+02:00";

/** Calendar date `yyyy-MM-dd` in academy local time. */
export function academyDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ACADEMY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

/** Instant of the next 00:00 in academy local time (strictly after `from`). */
export function nextAcademyMidnight(from: Date = new Date()): Date {
  const todayKey = academyDateKey(from);
  const tomorrowKey = format(addDays(parseISO(`${todayKey}T12:00:00`), 1), "yyyy-MM-dd");
  const midnight = parseISO(`${tomorrowKey}T00:00:00${ACADEMY_UTC_OFFSET}`);
  if (!isValid(midnight)) return addDays(from, 1);
  if (midnight.getTime() <= from.getTime()) {
    const dayAfter = format(addDays(parseISO(`${tomorrowKey}T12:00:00`), 1), "yyyy-MM-dd");
    return parseISO(`${dayAfter}T00:00:00${ACADEMY_UTC_OFFSET}`)!;
  }
  return midnight;
}

/** Milliseconds until the next academy midnight (for timers / revalidation). */
export function millisecondsUntilAcademyMidnight(from: Date = new Date()): number {
  const next = nextAcademyMidnight(from);
  return Math.max(next.getTime() - from.getTime(), 1000);
}
