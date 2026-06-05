"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, format, isValid, parseISO } from "date-fns";
import type { PublicScheduleSession, PublicWeeklySchedule } from "@/lib/weekly-schedule/types";
import { ScheduleSessionCard } from "@/components/schedule/ScheduleSessionCard";
import { UpdatedOnLine } from "@/components/schedule/UpdatedOnLine";
import { WeeklySessionModal } from "@/components/schedule/WeeklySessionModal";

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

type Props = {
  initialWeekStart?: string;
};

export function WeeklyScheduleView({ initialWeekStart }: Props) {
  const [weekStarts, setWeekStarts] = useState<string[]>([]);
  const [weekStart, setWeekStart] = useState(initialWeekStart ?? "");
  const [schedule, setSchedule] = useState<PublicWeeklySchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [selectedSession, setSelectedSession] = useState<PublicScheduleSession | null>(null);

  const loadWeeks = useCallback(async () => {
    const r = await fetch("/api/schedule/weeks", { cache: "no-store" });
    if (!r.ok) return;
    const data = (await r.json()) as { weekStarts: string[] };
    setWeekStarts(data.weekStarts);
    if (!weekStart && data.weekStarts.length) {
      setWeekStart(data.weekStarts[data.weekStarts.length - 1]!);
    }
  }, [weekStart]);

  const loadSchedule = useCallback(async (ws: string) => {
    if (!ws) return;
    setLoading(true);
    setErr("");
    try {
      const r = await fetch(`/api/schedule/public?weekStart=${encodeURIComponent(ws)}`, {
        cache: "no-store"
      });
      if (!r.ok) {
        const j = (await r.json()) as { message?: string };
        throw new Error(j.message ?? "Schedule not found");
      }
      const data = (await r.json()) as { schedule: PublicWeeklySchedule };
      setSchedule(data.schedule);
    } catch (e) {
      setSchedule(null);
      setErr(e instanceof Error ? e.message : "Failed to load schedule");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWeeks();
  }, [loadWeeks]);

  useEffect(() => {
    if (weekStart) loadSchedule(weekStart);
  }, [weekStart, loadSchedule]);

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, PublicScheduleSession[]>();
    for (const d of DAY_ORDER) map.set(d, []);
    if (!schedule) return map;
    for (const s of schedule.sessions) {
      const day = format(parseISO(s.startsAt), "EEEE");
      if (map.has(day)) map.get(day)!.push(s);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    }
    return map;
  }, [schedule]);

  const weekIdx = weekStarts.indexOf(weekStart);

  function goWeek(delta: number) {
    const next = weekStarts[weekIdx + delta];
    if (next) setWeekStart(next);
  }

  return (
    <div className="ws-public ws-public--centered">
      <header className="ws-public__header ws-public__header--center">
        <h2 className="ws-public__title">{schedule?.title ?? "Weekly Schedule"}</h2>
        {schedule ? (
          <>
            <p className="ws-public__range">{schedule.weekRangeLabel}</p>
            <UpdatedOnLine dateLabel={schedule.updatedOnLabel} />
          </>
        ) : null}
      </header>

      {weekStarts.length > 1 ? (
        <div className="ws-public__nav">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={weekIdx <= 0}
            onClick={() => goWeek(-1)}
          >
            Previous week
          </button>
          <span className="ws-public__nav-label">{weekStart || "—"}</span>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={weekIdx < 0 || weekIdx >= weekStarts.length - 1}
            onClick={() => goWeek(1)}
          >
            Next week
          </button>
        </div>
      ) : null}

      {loading ? <p className="muted ws-public__status">Loading schedule…</p> : null}
      {err ? <p className="form-message">{err}</p> : null}

      {!loading && schedule ? (
        <div className="ws-public__days">
          {DAY_ORDER.map((dayName, i) => {
            const dayDate = addDays(parseISO(`${schedule.week.weekStart}T12:00:00`), i);
            const sessions = sessionsByDay.get(dayName) ?? [];
            const dateLabel = isValid(dayDate) ? format(dayDate, "dd MMMM yyyy") : "";

            return (
              <section key={dayName} className="ws-day-section" aria-label={`${dayName} schedule`}>
                <header className="ws-day-section__head ws-day-section__head--center">
                  <h3 className="ws-day-section__title">{dayName}</h3>
                  <span className="ws-day-section__date muted">{dateLabel}</span>
                </header>

                {sessions.length === 0 ? (
                  <p className="ws-day-section__empty muted">No sessions scheduled.</p>
                ) : (
                  <ul className="ws-day-section__list ws-day-section__list--cards">
                    {sessions.map((s) => (
                      <ScheduleSessionCard key={s.id} session={s} onSelect={setSelectedSession} />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      ) : null}

      {selectedSession ? (
        <WeeklySessionModal session={selectedSession} onClose={() => setSelectedSession(null)} />
      ) : null}
    </div>
  );
}
