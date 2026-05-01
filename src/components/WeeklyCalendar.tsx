"use client";

import { useMemo, useState } from "react";
import {
  WEEKDAY_ORDER,
  type WeekdayName,
  type WeekScheduleByDay,
  type WeeklyCalendarEvent
} from "@/lib/weekly-schedule";

export { WEEKDAY_ORDER };
export type { WeekdayName, WeekScheduleByDay, WeeklyCalendarEvent };

export type WeeklyCalendarProps = {
  /** e.g. { Monday: [{ title, time, location }], ... } */
  scheduleByDay: WeekScheduleByDay;
  /** Line under the day strip, e.g. “Apr 7 – Apr 13, 2026” */
  weekRangeLabel?: string;
  /** Which day is selected on first paint (usually “today” if in range). */
  defaultSelectedDay?: WeekdayName;
};

function shortLabel(day: WeekdayName) {
  return day.slice(0, 3);
}

function isTodayDay(day: WeekdayName): boolean {
  const map: Record<number, WeekdayName> = {
    0: "Sunday",
    1: "Monday",
    2: "Tuesday",
    3: "Wednesday",
    4: "Thursday",
    5: "Friday",
    6: "Saturday"
  };
  return map[new Date().getDay()] === day;
}

/**
 * Weekly Mon–Sun selector with pathway-themed styling.
 * Styles use globals.css (`.weekly-cal-*`) — Tailwind is not wired in this repo.
 */
export function WeeklyCalendar({ scheduleByDay, weekRangeLabel, defaultSelectedDay = "Monday" }: WeeklyCalendarProps) {
  const [selected, setSelected] = useState<WeekdayName>(defaultSelectedDay);
  const [panelKey, setPanelKey] = useState(0);

  const events = scheduleByDay[selected] ?? [];

  const counts = useMemo(() => {
    const c: Record<WeekdayName, number> = {
      Monday: 0,
      Tuesday: 0,
      Wednesday: 0,
      Thursday: 0,
      Friday: 0,
      Saturday: 0,
      Sunday: 0
    };
    for (const d of WEEKDAY_ORDER) c[d] = scheduleByDay[d]?.length ?? 0;
    return c;
  }, [scheduleByDay]);

  function pickDay(day: WeekdayName) {
    if (day === selected) return;
    setSelected(day);
    setPanelKey((k) => k + 1);
  }

  return (
    <div className="weekly-cal">
      {weekRangeLabel ? <p className="weekly-cal__range muted">{weekRangeLabel}</p> : null}

      <div className="weekly-cal__strip" role="tablist" aria-label="Week days">
        {WEEKDAY_ORDER.map((day) => {
          const isSelected = selected === day;
          const today = isTodayDay(day);
          return (
            <button
              key={day}
              type="button"
              role="tab"
              aria-selected={isSelected}
              className={`weekly-cal__day${isSelected ? " weekly-cal__day--selected" : ""}${today ? " weekly-cal__day--today" : ""}`}
              onClick={() => pickDay(day)}
            >
              <span className="weekly-cal__day-short">{shortLabel(day)}</span>
              <span className="weekly-cal__day-full">{day}</span>
              {counts[day] > 0 ? <span className="weekly-cal__day-badge">{counts[day]}</span> : null}
            </button>
          );
        })}
      </div>

      <div
        key={panelKey}
        className="weekly-cal__panel"
        role="tabpanel"
        aria-label={`${selected} schedule`}
      >
        {events.length === 0 ? (
          <p className="weekly-cal__empty muted">No sessions on {selected}.</p>
        ) : (
          <ul className="weekly-cal__list">
            {events.map((ev, i) => (
              <li key={`${selected}-${i}-${ev.title}-${ev.time}`} className="weekly-cal__card">
                <div className="weekly-cal__card-accent" aria-hidden />
                <div className="weekly-cal__card-body">
                  <div className="weekly-cal__card-title-row">
                    <p className="weekly-cal__card-title">{ev.title}</p>
                    {ev.isUpdated ? (
                      <span className="weekly-cal__updated-pill" title={ev.updatedAt ? `Updated at ${ev.updatedAt}` : "Recently updated"}>
                        Updated
                      </span>
                    ) : null}
                  </div>
                  <p className="weekly-cal__card-time">
                    <span className="weekly-cal__time-bit">Start {ev.startTime}</span>
                    <span className="weekly-cal__time-sep" aria-hidden>
                      ·
                    </span>
                    <span className="weekly-cal__time-bit">End {ev.endTime}</span>
                  </p>
                  {ev.isUpdated && ev.updatedAt ? (
                    <p className="weekly-cal__updated-at muted">Updated at: {new Date(ev.updatedAt).toLocaleString()}</p>
                  ) : null}
                  {ev.location ? <p className="weekly-cal__card-loc muted">{ev.location}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
