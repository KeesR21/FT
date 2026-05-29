"use client";

import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  format,
  isSameDay,
  isValid,
  parseISO,
  startOfWeek,
  subMonths,
  subWeeks
} from "date-fns";
import {
  buildMonthGrid,
  groupSessionsByDate,
  monthLabel,
  weekRangeLabel
} from "@/lib/schedule-calendar";
import { ageGroupColor } from "@/lib/timetable-session";
import type { TimetableSession } from "@/lib/types";
import { SessionDayModal } from "./SessionDayModal";

type ViewMode = "month" | "week";

type Props = {
  sessions: TimetableSession[];
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function ScheduleExperience({ sessions }: Props) {
  const [view, setView] = useState<ViewMode>("month");
  const [monthAnchor, setMonthAnchor] = useState(() => new Date());
  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  const sessionsByDate = useMemo(() => groupSessionsByDate(sessions), [sessions]);
  const monthCells = useMemo(
    () => buildMonthGrid(monthAnchor, sessionsByDate),
    [monthAnchor, sessionsByDate]
  );
  const modalSessions = selectedDateKey ? sessionsByDate.get(selectedDateKey) ?? [] : [];

  function openDay(dateKey: string) {
    setSelectedDateKey(dateKey);
  }

  return (
    <div className="sched-exp">
      <div className="sched-exp__toolbar">
        <div className="sched-exp__view-toggle" role="tablist" aria-label="Calendar view">
          <button
            type="button"
            role="tab"
            aria-selected={view === "month"}
            className={`sched-exp__view-btn${view === "month" ? " sched-exp__view-btn--active" : ""}`}
            onClick={() => setView("month")}
          >
            Month
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "week"}
            className={`sched-exp__view-btn${view === "week" ? " sched-exp__view-btn--active" : ""}`}
            onClick={() => setView("week")}
          >
            Week
          </button>
        </div>

        <div className="sched-exp__nav">
          {view === "month" ? (
            <>
              <button
                type="button"
                className="btn btn-secondary sched-exp__nav-btn"
                onClick={() => setMonthAnchor((m) => subMonths(m, 1))}
                aria-label="Previous month"
              >
                ←
              </button>
              <span className="sched-exp__nav-label">{monthLabel(monthAnchor)}</span>
              <button
                type="button"
                className="btn btn-secondary sched-exp__nav-btn"
                onClick={() => setMonthAnchor((m) => addMonths(m, 1))}
                aria-label="Next month"
              >
                →
              </button>
              <button type="button" className="btn btn-secondary sched-exp__today" onClick={() => setMonthAnchor(new Date())}>
                Today
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-secondary sched-exp__nav-btn"
                onClick={() => setWeekAnchor((w) => subWeeks(w, 1))}
                aria-label="Previous week"
              >
                ←
              </button>
              <span className="sched-exp__nav-label">{weekRangeLabel(weekAnchor)}</span>
              <button
                type="button"
                className="btn btn-secondary sched-exp__nav-btn"
                onClick={() => setWeekAnchor((w) => addWeeks(w, 1))}
                aria-label="Next week"
              >
                →
              </button>
              <button
                type="button"
                className="btn btn-secondary sched-exp__today"
                onClick={() => setWeekAnchor(startOfWeek(new Date(), { weekStartsOn: 1 }))}
              >
                This week
              </button>
            </>
          )}
        </div>
      </div>

      {view === "month" ? (
        <div className="sched-exp__month" aria-label="Monthly calendar">
          <div className="sched-exp__month-head">
            {WEEKDAYS.map((d) => (
              <span key={d} className="sched-exp__dow">
                {d}
              </span>
            ))}
          </div>
          <div className="sched-exp__month-grid">
            {monthCells.map((cell) => {
              const daySessions = sessionsByDate.get(cell.dateKey) ?? [];
              const dots = daySessions.slice(0, 4);
              return (
                <button
                  key={cell.dateKey}
                  type="button"
                  className={`sched-exp__day${cell.inMonth ? "" : " sched-exp__day--outside"}${cell.isToday ? " sched-exp__day--today" : ""}${cell.sessionCount ? " sched-exp__day--has" : ""}`}
                  onClick={() => openDay(cell.dateKey)}
                  aria-label={`${format(cell.date, "MMMM d")}, ${cell.sessionCount} sessions`}
                >
                  <span className="sched-exp__day-num">{format(cell.date, "d")}</span>
                  {dots.length > 0 ? (
                    <span className="sched-exp__dots" aria-hidden>
                      {dots.map((s) => {
                        const c = ageGroupColor(s.ageGroup);
                        return (
                          <span
                            key={s.id}
                            className="sched-exp__dot"
                            style={{ background: c.border }}
                          />
                        );
                      })}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="sched-exp__week" aria-label="Weekly timetable">
          {Array.from({ length: 7 }, (_, i) => {
            const day = addDays(weekAnchor, i);
            const key = format(day, "yyyy-MM-dd");
            const daySessions = sessionsByDate.get(key) ?? [];
            const today = isSameDay(day, new Date());
            return (
              <button
                key={key}
                type="button"
                className={`sched-exp__week-col${today ? " sched-exp__week-col--today" : ""}`}
                onClick={() => openDay(key)}
              >
                <span className="sched-exp__week-dow">{format(day, "EEE")}</span>
                <span className="sched-exp__week-dom">{format(day, "d MMM")}</span>
                <div className="sched-exp__week-sessions">
                  {daySessions.length === 0 ? (
                    <span className="muted sched-exp__week-empty">—</span>
                  ) : (
                    daySessions.map((s) => {
                      const start = parseISO(s.startsAt);
                      const c = ageGroupColor(s.ageGroup);
                      return (
                        <span
                          key={s.id}
                          className="sched-exp__week-pill"
                          style={{
                            background: c.bg,
                            borderColor: c.border,
                            color: c.text
                          }}
                        >
                          {isValid(start) ? format(start, "HH:mm") : ""} {s.title}
                        </span>
                      );
                    })
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selectedDateKey ? (
        <SessionDayModal
          dateKey={selectedDateKey}
          sessions={modalSessions}
          onClose={() => setSelectedDateKey(null)}
        />
      ) : null}
    </div>
  );
}
