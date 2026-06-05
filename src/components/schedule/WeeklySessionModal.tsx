"use client";

import { useEffect, useRef } from "react";
import { format, isValid, parseISO } from "date-fns";
import type { PublicScheduleSession } from "@/lib/weekly-schedule/types";
import { sortAgeGroups } from "@/lib/age-groups";
import { sessionCardImageFilename } from "@/lib/download-session-card-image";
import { SchedulePopupLogo } from "@/components/schedule/SchedulePopupLogo";
import { ScheduleCardDownloadButton } from "@/components/schedule/ScheduleCardDownloadButton";
import { SessionGroupTags, sessionGroupsDisplayLine } from "@/components/schedule/SessionGroupTags";

function SessionDetailStats({
  pitchName,
  groups,
  groupsLabel = "Groups",
  periodLabel
}: {
  pitchName: string;
  groups: readonly string[];
  groupsLabel?: string;
  periodLabel?: string;
}) {
  return (
    <div className="ws-session-popup__stats">
      <div className="ws-session-popup__stat">
        <span className="ws-session-popup__stat-label">Location</span>
        <span className="ws-session-popup__stat-value">{pitchName}</span>
      </div>
      {groups.length > 0 ? (
        <div className="ws-session-popup__stat">
          <span className="ws-session-popup__stat-label">{groupsLabel}</span>
          <SessionGroupTags groups={groups} />
        </div>
      ) : null}
      {periodLabel ? (
        <div className="ws-session-popup__stat">
          <span className="ws-session-popup__stat-label">Period</span>
          <span className="ws-session-popup__stat-value">{periodLabel}</span>
        </div>
      ) : null}
    </div>
  );
}

function CoachesSection({ coachNames }: { coachNames: string[] }) {
  return (
    <section className="ws-session-popup__section ws-session-popup__section--coaches">
      <h3 className="ws-session-popup__section-title">
        <svg className="ws-session-popup__coaches-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M10 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-6 8a6 6 0 0 1 12 0H4Z" />
        </svg>
        Coaches
      </h3>
      <p className="ws-session-popup__section-text">
        {coachNames.length > 0 ? coachNames.join(", ") : <em className="ws-session-popup__coaches-empty">Not assigned</em>}
      </p>
    </section>
  );
}

type Props = {
  session: PublicScheduleSession;
  onClose: () => void;
};

export function WeeklySessionModal({ session, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const captureRef = useRef<HTMLDivElement>(null);

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

  const start = parseISO(session.startsAt);
  const end = parseISO(session.endsAt);
  const timeLabel =
    isValid(start) && isValid(end) ? `${format(start, "h:mm a")} – ${format(end, "h:mm a")}` : "—";
  const dateLabel = isValid(start) ? format(start, "EEEE, dd MMMM yyyy") : "";
  const completed = session.completed;

  const isMatch = session.type === "match";
  const isRest = session.type === "rest";
  const sortedGroups = sortAgeGroups(session.ageGroups);
  const groupsLine = sessionGroupsDisplayLine(session.ageGroups);
  const trainingTitle = sortedGroups.length > 0 ? groupsLine : isRest ? "Rest session" : "Training session";
  const displayTitle = isMatch ? `${session.teamA} vs ${session.teamB}` : trainingTitle;
  const downloadFilename = sessionCardImageFilename({
    type: session.type,
    startsAt: session.startsAt,
    title: displayTitle
  });

  return (
    <div className="ws-session-popup" role="dialog" aria-modal="true" aria-labelledby="ws-session-title">
      <button type="button" className="ws-session-popup__backdrop" aria-label="Close" onClick={onClose} />
      <div
        className={`ws-session-popup__panel${isMatch ? " ws-session-popup__panel--match" : " ws-session-popup__panel--training"}`}
      >
        <div ref={captureRef} className="ws-session-popup__capture">
          <div className="ws-session-popup__inner">
            <SchedulePopupLogo />
            <span
              className={`ws-session-popup__badge${isMatch ? " ws-session-popup__badge--match" : " ws-session-popup__badge--training"}`}
            >
              {isMatch ? "⚽ Match Day" : session.typeLabel}
            </span>
            {completed ? (
              <span className="ws-session-popup__badge ws-session-popup__badge--completed">✓ Completed</span>
            ) : null}

            {isMatch ? (
              <h2 id="ws-session-title" className="ws-session-popup__match-title">
                <span>{session.teamA}</span>
                <span className="ws-session-popup__vs">VS</span>
                <span>{session.teamB}</span>
              </h2>
            ) : (
              <h2 id="ws-session-title" className="ws-session-popup__title">
                {trainingTitle}
              </h2>
            )}

            <p className="ws-session-popup__meta">
              {dateLabel ? <span className="ws-session-popup__date">{dateLabel}</span> : null}
              <span className="ws-session-popup__time">{timeLabel}</span>
            </p>

            <div className="ws-session-popup__body">
              {!isMatch ? (
                <>
                  <SessionDetailStats
                    pitchName={session.pitchName}
                    groups={session.ageGroups}
                    periodLabel={session.periodLabel}
                  />

                  {session.trainingTopic ? (
                    <section className="ws-session-popup__section">
                      <h3 className="ws-session-popup__section-title">
                        {isRest ? "Rest plan" : "Training activities"}
                      </h3>
                      <p className="ws-session-popup__section-text">{session.trainingTopic}</p>
                    </section>
                  ) : null}

                  <CoachesSection coachNames={session.coachNames} />

                  {session.objectives ? (
                    <section className="ws-session-popup__section">
                      <h3 className="ws-session-popup__section-title">Objectives</h3>
                      <p className="ws-session-popup__section-text">{session.objectives}</p>
                    </section>
                  ) : null}

                  {session.kit ? (
                    <section className="ws-session-popup__section">
                      <h3 className="ws-session-popup__section-title">Kit / equipment</h3>
                      <p className="ws-session-popup__section-text">{session.kit}</p>
                    </section>
                  ) : null}
                </>
              ) : (
                <>
                  <SessionDetailStats
                    pitchName={session.pitchName}
                    groups={session.ageGroups}
                    groupsLabel="Squad"
                  />
                  {session.matchNotes ? (
                    <section className="ws-session-popup__section">
                      <h3 className="ws-session-popup__section-title">Notes</h3>
                      <p className="ws-session-popup__section-text">{session.matchNotes}</p>
                    </section>
                  ) : null}
                  <CoachesSection coachNames={session.coachNames} />
                </>
              )}
            </div>
          </div>
        </div>

        <footer className="ws-session-popup__footer">
          <ScheduleCardDownloadButton captureRef={captureRef} filename={downloadFilename} />
          <button
            ref={closeRef}
            type="button"
            className="ws-session-popup__action-btn"
            onClick={onClose}
          >
            <svg
              className="ws-session-popup__action-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
            <span className="ws-session-popup__action-label">Close</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
