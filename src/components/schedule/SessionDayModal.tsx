"use client";

import { useEffect, useRef } from "react";
import { format, parseISO, isValid } from "date-fns";
import type { TimetableSession } from "@/lib/types";
import { SessionDetailCard } from "./SessionDetailCard";
import { SchedulePopupLogo } from "@/components/schedule/SchedulePopupLogo";

type Props = {
  dateKey: string;
  sessions: TimetableSession[];
  onClose: () => void;
};

export function SessionDayModal({ dateKey, sessions, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const d = parseISO(`${dateKey}T12:00:00`);
  const title = isValid(d) ? format(d, "EEEE, MMMM d, yyyy") : dateKey;

  return (
    <div className="sched-day-modal" role="dialog" aria-modal="true" aria-labelledby="sched-day-modal-title">
      <button type="button" className="sched-day-modal__backdrop" aria-label="Close schedule" onClick={onClose} />
      <div className="sched-day-modal__panel">
        <header className="sched-day-modal__header sched-day-modal__header--centered">
          <SchedulePopupLogo />
          <div>
            <p className="sched-day-modal__eyebrow">Day schedule</p>
            <h2 id="sched-day-modal-title" className="sched-day-modal__title">
              {title}
            </h2>
            <p className="sched-day-modal__sub muted">
              {sessions.length === 0
                ? "No sessions on this date."
                : `${sessions.length} session${sessions.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <button ref={closeRef} type="button" className="sched-day-modal__close btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="sched-day-modal__body">
          {sessions.length === 0 ? (
            <p className="muted sched-day-modal__empty">Check another date or come back when sessions are published.</p>
          ) : (
            <div className="sched-day-modal__list">
              {sessions.map((s) => (
                <SessionDetailCard key={s.id} session={s} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
