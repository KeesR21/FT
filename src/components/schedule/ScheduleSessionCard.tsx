"use client";

import type { CSSProperties } from "react";
import { format, isValid, parseISO } from "date-fns";
import type { PublicScheduleSession } from "@/lib/weekly-schedule/types";
import { sortAgeGroups } from "@/lib/age-groups";
import { sessionGroupsDisplayLine } from "@/components/schedule/SessionGroupTags";
import { ageGroupColor } from "@/lib/timetable-session";

type Props = {
  session: PublicScheduleSession;
  onSelect: (session: PublicScheduleSession) => void;
};

function CompletedBadge() {
  return <span className="ws-session-card__badge ws-session-card__badge--completed">✓ Completed</span>;
}

export function ScheduleSessionCard({ session, onSelect }: Props) {
  const start = parseISO(session.startsAt);
  const end = parseISO(session.endsAt);
  const timeLabel =
    isValid(start) && isValid(end) ? `${format(start, "h:mm a")} – ${format(end, "h:mm a")}` : "—";
  const dateLabel = isValid(start) ? format(start, "EEEE, dd MMMM yyyy") : "";
  const completed = session.completed;

  if (session.type === "match") {
    return (
      <li className="ws-day-section__list-item">
        <button
          type="button"
          className={`ws-session-card ws-session-card--match${completed ? " ws-session-card--completed" : ""}`}
          onClick={() => onSelect(session)}
        >
          <span className="ws-session-card__badge ws-session-card__badge--match">⚽ Match Day</span>
          {completed && <CompletedBadge />}
          <p className="ws-session-card__match-teams">
            <span>{session.teamA}</span>
            <span className="ws-session-card__vs">VS</span>
            <span>{session.teamB}</span>
          </p>
          {dateLabel && <p className="ws-session-card__date">{dateLabel}</p>}
          <p className="ws-session-card__time">{timeLabel}</p>
          <p className="ws-session-card__detail">{session.pitchName}</p>
          {session.coachNames.length > 0 && (
            <p className="ws-session-card__coaches">
              <span className="ws-session-card__coaches-icon" aria-hidden>👤</span>
              {session.coachNames.join(", ")}
            </p>
          )}
        </button>
      </li>
    );
  }

  if (session.type === "rest") {
    return (
      <li className="ws-day-section__list-item">
        <button
          type="button"
          className={`ws-session-card ws-session-card--training${completed ? " ws-session-card--completed" : ""}`}
          onClick={() => onSelect(session)}
        >
          <span className="ws-session-card__badge ws-session-card__badge--training">Rest</span>
          {completed && <CompletedBadge />}
          {dateLabel && <p className="ws-session-card__date">{dateLabel}</p>}
          <p className="ws-session-card__time">{timeLabel}</p>
          <p className="ws-session-card__groups">{sessionGroupsDisplayLine(session.ageGroups) || "All squads"}</p>
          <p className="ws-session-card__detail muted">{session.trainingTopic || "Recovery / rest"}</p>
          <p className="ws-session-card__detail muted">{session.pitchName}</p>
        </button>
      </li>
    );
  }

  const sortedGroups = sortAgeGroups(session.ageGroups);
  const primary = sortedGroups[0] ?? "U9";
  const c = ageGroupColor(primary);

  return (
    <li className="ws-day-section__list-item">
      <button
        type="button"
        className={`ws-session-card ws-session-card--training${completed ? " ws-session-card--completed" : ""}`}
        style={
          {
            "--ws-accent-border": c.border,
            "--ws-accent-bg": c.bg,
            "--ws-accent-text": c.text
          } as CSSProperties
        }
        onClick={() => onSelect(session)}
      >
        <span className="ws-session-card__badge ws-session-card__badge--training">Training</span>
        {completed && <CompletedBadge />}
        {dateLabel && <p className="ws-session-card__date">{dateLabel}</p>}
        <p className="ws-session-card__time">{timeLabel}</p>
        <p className="ws-session-card__groups">{sessionGroupsDisplayLine(session.ageGroups)}</p>
        <p className="ws-session-card__detail muted">{session.periodLabel}</p>
        {session.coachNames.length > 0 && (
          <p className="ws-session-card__coaches">
            <span className="ws-session-card__coaches-icon" aria-hidden>👤</span>
            {session.coachNames.join(", ")}
          </p>
        )}
        <p className="ws-session-card__detail muted">{session.pitchName}</p>
      </button>
    </li>
  );
}
