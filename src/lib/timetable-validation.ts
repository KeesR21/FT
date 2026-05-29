import { differenceInMinutes, getHours, getMinutes, isValid, parseISO } from "date-fns";

/** Earliest session start (24h local wall clock of the parsed instant). */
export const TIMETABLE_MIN_START_HOUR = 6;
/** Latest session start (must start by this hour inclusive for whole session start minute). */
export const TIMETABLE_MAX_START_HOUR = 21;
/** Latest session end by 22:00. */
export const TIMETABLE_MAX_END_HOUR = 22;

/** Clock skew / UX grace when comparing to “now” (ms). */
const PAST_GRACE_MS = 60_000;

export type TimetableValidationResult = { ok: true } | { ok: false; error: string };

/**
 * Start must not be in the past (same calendar day must not be earlier than current time).
 * `referenceNow` defaults to `new Date()` — pass a fixed instant in tests.
 */
export function validateSessionNotInPast(startsAtIso: string, referenceNow: Date = new Date()): TimetableValidationResult {
  const start = parseISO(startsAtIso);
  if (!isValid(start)) {
    return { ok: false, error: "Invalid start date." };
  }
  if (start.getTime() < referenceNow.getTime() - PAST_GRACE_MS) {
    return {
      ok: false,
      error: "Choose a future date and time. Past slots cannot be scheduled."
    };
  }
  return { ok: true };
}

/**
 * Validates session window: ordering, duration, and realistic academy hours.
 * Uses the instant's local wall time (same as typical `datetime-local` → ISO flow).
 */
export function validateSessionTimes(startsAtIso: string, endsAtIso: string): TimetableValidationResult {
  const start = parseISO(startsAtIso);
  const end = parseISO(endsAtIso);
  if (!isValid(start) || !isValid(end)) {
    return { ok: false, error: "Invalid start or end date." };
  }
  if (end <= start) {
    return { ok: false, error: "End time must be after start time." };
  }
  const mins = differenceInMinutes(end, start);
  if (mins < 30) {
    return { ok: false, error: "Sessions must be at least 30 minutes." };
  }
  if (mins > 300) {
    return { ok: false, error: "Sessions cannot exceed 5 hours." };
  }

  const sh = getHours(start);
  const sm = getMinutes(start);
  const eh = getHours(end);
  const em = getMinutes(end);

  if (sh < TIMETABLE_MIN_START_HOUR) {
    return { ok: false, error: `Sessions cannot start before ${TIMETABLE_MIN_START_HOUR}:00 AM.` };
  }
  if (sh > TIMETABLE_MAX_START_HOUR || (sh === TIMETABLE_MAX_START_HOUR && sm > 0)) {
    return { ok: false, error: "Sessions cannot start after 9:00 PM." };
  }
  if (eh > TIMETABLE_MAX_END_HOUR || (eh === TIMETABLE_MAX_END_HOUR && em > 0)) {
    return { ok: false, error: "Sessions must end by 10:00 PM." };
  }

  return { ok: true };
}

/** Full check: not in the past + window rules (use on create/update). */
export function validateScheduleWindow(
  startsAtIso: string,
  endsAtIso: string,
  referenceNow: Date = new Date()
): TimetableValidationResult {
  const past = validateSessionNotInPast(startsAtIso, referenceNow);
  if (!past.ok) return past;
  return validateSessionTimes(startsAtIso, endsAtIso);
}

export { defaultSessionTitle } from "@/lib/timetable-session";
