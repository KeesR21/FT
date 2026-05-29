"use client";

import type { CSSProperties } from "react";
import { format, isValid, parseISO } from "date-fns";
import {
  ageGroupColor,
  sessionDurationMinutes,
  sessionGroupsLabel
} from "@/lib/timetable-session";
import type { TimetableSession } from "@/lib/types";

type Props = {
  session: TimetableSession;
};

export function SessionDetailCard({ session }: Props) {
  const start = parseISO(session.startsAt);
  const end = parseISO(session.endsAt);
  const color = ageGroupColor(session.ageGroup);
  const durationH = sessionDurationMinutes(session.startsAt, session.endsAt);
  const durationLabel =
    durationH >= 60
      ? `${Math.floor(durationH / 60)}h${durationH % 60 ? ` ${durationH % 60}m` : ""}`
      : `${durationH} min`;

  return (
    <article
      className="sched-session-card"
      style={
        {
          "--sched-accent-bg": color.bg,
          "--sched-accent-border": color.border,
          "--sched-accent-text": color.text
        } as CSSProperties
      }
    >
      <div className="sched-session-card__accent" aria-hidden />
      <header className="sched-session-card__head">
        <div>
          <span className="sched-session-card__group">{sessionGroupsLabel(session)}</span>
          <h3 className="sched-session-card__title">{session.title}</h3>
        </div>
        <span className={`sched-session-card__kind sched-session-card__kind--${session.kind}`}>
          {session.kind === "match" ? "Match" : "Training"}
        </span>
      </header>

      <dl className="sched-session-card__meta">
        <div>
          <dt>Time</dt>
          <dd>
            {isValid(start) && isValid(end)
              ? `${format(start, "h:mm a")} – ${format(end, "h:mm a")}`
              : "—"}
          </dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>{durationLabel}</dd>
        </div>
        {session.trainerName ? (
          <div>
            <dt>Trainer</dt>
            <dd>{session.trainerName}</dd>
          </div>
        ) : null}
        {session.locationName ? (
          <div>
            <dt>Location</dt>
            <dd>{session.locationName}</dd>
          </div>
        ) : null}
      </dl>

      {session.activities.length > 0 ? (
        <div className="sched-session-card__section">
          <p className="sched-session-card__section-label">Activities &amp; topics</p>
          <ul className="sched-session-card__tags">
            {session.activities.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {session.sessionObjectives ? (
        <div className="sched-session-card__section">
          <p className="sched-session-card__section-label">Objectives</p>
          <p className="sched-session-card__text">{session.sessionObjectives}</p>
        </div>
      ) : null}

      {session.equipmentNotes ? (
        <div className="sched-session-card__section">
          <p className="sched-session-card__section-label">Equipment</p>
          <p className="sched-session-card__text">{session.equipmentNotes}</p>
        </div>
      ) : null}

      {session.kitRequirements ? (
        <div className="sched-session-card__section">
          <p className="sched-session-card__section-label">Kit</p>
          <p className="sched-session-card__text">{session.kitRequirements}</p>
        </div>
      ) : null}

      {session.isUpdated ? (
        <span className="weekly-cal__updated-pill sched-session-card__updated">Updated</span>
      ) : null}
    </article>
  );
}
