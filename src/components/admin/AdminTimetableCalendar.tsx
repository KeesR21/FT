"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDays,
  addMinutes,
  addWeeks,
  differenceInMinutes,
  format,
  isValid,
  parseISO,
  setHours,
  setMinutes,
  startOfDay,
  startOfWeek
} from "date-fns";
import { AGE_GROUPS } from "@/lib/age-groups";
import { adminApiFetch } from "@/lib/admin-api-fetch";
import type { TimetableSession } from "@/lib/types";
import {
  TIMETABLE_MAX_END_HOUR,
  TIMETABLE_MAX_START_HOUR,
  TIMETABLE_MIN_START_HOUR,
  defaultSessionTitle,
  validateScheduleWindow,
  validateSessionTimes
} from "@/lib/timetable-validation";

const PAST_GRACE_MS = 60_000;

const DURATION_OPTIONS = [30, 45, 60, 90, 120, 150, 180] as const;

const LOCATION_PRESETS = [
  "Main Academy Pitch",
  "Lion Arena",
  "Regional Stadium",
  "Training ground B",
  "Indoor hall"
];

function gridTotalMinutes() {
  return (TIMETABLE_MAX_END_HOUR - TIMETABLE_MIN_START_HOUR) * 60;
}

function eventBlockStyle(startsAt: string, endsAt: string): { top: string; height: string } {
  const s = parseISO(startsAt);
  const e = parseISO(endsAt);
  if (!isValid(s) || !isValid(e)) return { top: "0%", height: "5%" };
  const dayStart = setMinutes(setHours(startOfDay(s), TIMETABLE_MIN_START_HOUR), 0);
  const gridEnd = setMinutes(setHours(startOfDay(s), TIMETABLE_MAX_END_HOUR), 0);
  const totalMin = gridTotalMinutes();
  let topMin = differenceInMinutes(s, dayStart);
  let visibleStart = s;
  if (topMin < 0) {
    visibleStart = dayStart;
    topMin = 0;
  }
  const endClamped = e > gridEnd ? gridEnd : e;
  const dur = Math.max(15, differenceInMinutes(endClamped, visibleStart));
  return {
    top: `${Math.min(100, Math.max(0, (topMin / totalMin) * 100))}%`,
    height: `${Math.min(100, Math.max(2, (dur / totalMin) * 100))}%`
  };
}

function buildEndTimeChoices(slotStart: Date): { label: string; at: Date }[] {
  const out: { label: string; at: Date }[] = [];
  const limit = setMinutes(setHours(startOfDay(slotStart), TIMETABLE_MAX_END_HOUR), 0);
  let t = addMinutes(slotStart, 30);
  while (t <= limit && differenceInMinutes(t, slotStart) <= 300) {
    out.push({ label: format(t, "h:mm a"), at: t });
    t = addMinutes(t, 15);
  }
  return out;
}

function slotStartForCell(day: Date, hour: number) {
  return setMinutes(setHours(startOfDay(day), hour), 0);
}

function isSlotInPast(slotStart: Date, now: Date) {
  return slotStart.getTime() < now.getTime() - PAST_GRACE_MS;
}

type ModalState =
  | null
  | { mode: "create"; slotStart: Date }
  | { mode: "edit"; session: TimetableSession };

export function AdminTimetableCalendar() {
  const [sessions, setSessions] = useState<TimetableSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [weekOffset, setWeekOffset] = useState(0);
  const [modal, setModal] = useState<ModalState>(null);
  const [endMode, setEndMode] = useState<"duration" | "endTime">("duration");
  const [durationMins, setDurationMins] = useState<number>(60);
  const [endChoiceIdx, setEndChoiceIdx] = useState(0);

  const [ageGroup, setAgeGroup] = useState("U9");
  const [kind, setKind] = useState<"training" | "match">("training");
  const [locationName, setLocationName] = useState(LOCATION_PRESETS[0]!);
  const [kitRequirements, setKitRequirements] = useState("Full kit");

  const weekStart = useMemo(
    () => startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 }),
    [weekOffset]
  );

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const hourRows = useMemo(() => {
    const rows: number[] = [];
    for (let h = TIMETABLE_MIN_START_HOUR; h <= TIMETABLE_MAX_START_HOUR; h++) rows.push(h);
    return rows;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const r = await fetch("/api/timetable", { credentials: "include", cache: "no-store" });
      if (!r.ok) throw new Error(await r.text());
      const data = (await r.json()) as { sessions: TimetableSession[] };
      setSessions([...data.sessions].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sessionsByDayKey = useMemo(() => {
    const m = new Map<string, TimetableSession[]>();
    for (const s of sessions) {
      const d = parseISO(s.startsAt);
      if (!isValid(d)) continue;
      const key = format(d, "yyyy-MM-dd");
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(s);
    }
    for (const list of m.values()) list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return m;
  }, [sessions]);

  const endChoices = useMemo(() => {
    if (!modal) return [];
    const s = modal.mode === "create" ? modal.slotStart : parseISO(modal.session.startsAt);
    if (!isValid(s)) return [];
    return buildEndTimeChoices(s);
  }, [modal]);

  const computedTitle = useMemo(() => defaultSessionTitle(ageGroup, kind), [ageGroup, kind]);

  function openCreate(day: Date, hour: number) {
    setErr("");
    const slotStart = slotStartForCell(day, hour);
    if (isSlotInPast(slotStart, new Date())) {
      setErr("That time has already passed. Choose a future slot.");
      return;
    }
    setEndMode("duration");
    setDurationMins(60);
    setEndChoiceIdx(0);
    setAgeGroup("U9");
    setKind("training");
    setLocationName(LOCATION_PRESETS[0]!);
    setKitRequirements("Full kit");
    setModal({ mode: "create", slotStart });
  }

  function openEdit(s: TimetableSession) {
    setErr("");
    const start = parseISO(s.startsAt);
    const end = parseISO(s.endsAt);
    if (!isValid(start)) return;
    setAgeGroup(s.ageGroup);
    setKind(s.kind);
    setLocationName(s.locationName);
    setKitRequirements(s.kitRequirements);
    const mins = isValid(end) ? differenceInMinutes(end, start) : 60;
    const matchDur = (DURATION_OPTIONS as readonly number[]).includes(mins) ? mins : 60;
    setDurationMins(matchDur);
    const choices = buildEndTimeChoices(start);
    const endIdx = choices.findIndex((c) => Math.abs(c.at.getTime() - (isValid(end) ? end.getTime() : 0)) < 60 * 1000);
    setEndChoiceIdx(endIdx >= 0 ? endIdx : Math.max(0, choices.length - 1));
    setEndMode("duration");
    setModal({ mode: "edit", session: s });
  }

  function closeModal() {
    setModal(null);
  }

  function resolveEndsAt(start: Date): Date | null {
    if (endMode === "duration") {
      return addMinutes(start, durationMins);
    }
    const ch = endChoices[endChoiceIdx];
    return ch ? ch.at : null;
  }

  async function saveSession() {
    if (!modal) return;
    setErr("");
    const start =
      modal.mode === "create"
        ? modal.slotStart
        : parseISO(modal.session.startsAt);
    if (!isValid(start)) {
      setErr("Invalid start time.");
      return;
    }
    const endsAtDate = resolveEndsAt(start);
    if (!endsAtDate) {
      setErr("Pick a valid end time.");
      return;
    }
    const startsAt = start.toISOString();
    const endsAt = endsAtDate.toISOString();
    const sameStartAsExisting = modal.mode === "edit" && startsAt === modal.session.startsAt;
    const localCheck = sameStartAsExisting
      ? validateSessionTimes(startsAt, endsAt)
      : validateScheduleWindow(startsAt, endsAt);
    if (!localCheck.ok) {
      setErr(localCheck.error);
      return;
    }

    const body = {
      title: computedTitle.trim(),
      ageGroup,
      kind,
      startsAt,
      endsAt,
      locationName: locationName.trim(),
      kitRequirements: kitRequirements.trim()
    };

    try {
      if (modal.mode === "create") {
        const r = await adminApiFetch("/api/admin/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        const raw = await r.text();
        if (!r.ok) {
          const j = JSON.parse(raw) as { message?: string };
          throw new Error(j.message ?? raw);
        }
      } else {
        const r = await adminApiFetch(`/api/admin/timetable/${modal.session.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        const raw = await r.text();
        if (!r.ok) {
          const j = JSON.parse(raw) as { message?: string };
          throw new Error(j.message ?? raw);
        }
      }
      closeModal();
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function removeSession(id: string) {
    if (!confirm("Delete this session?")) return;
    const r = await adminApiFetch(`/api/admin/timetable/${id}`, { method: "DELETE" });
    if (!r.ok) setErr(await r.text());
    else {
      closeModal();
      load();
    }
  }

  return (
    <>
      <div className="card admin-sched">
        <div className="admin-sched__head">
          <div>
            <h2 className="admin-sched__title">Week grid</h2>
            <p className="muted admin-sched__sub">
              Click an empty future hour to add a session. Click a block to edit. Date and start time are set from the
              grid only — no typing.
            </p>
          </div>
          <div className="admin-sched__week-nav">
            <button type="button" className="btn btn-secondary admin-btn-sm" onClick={() => setWeekOffset((w) => w - 1)}>
              Previous week
            </button>
            <button type="button" className="btn btn-secondary admin-btn-sm" onClick={() => setWeekOffset(0)}>
              This week
            </button>
            <button type="button" className="btn btn-secondary admin-btn-sm" onClick={() => setWeekOffset((w) => w + 1)}>
              Next week
            </button>
          </div>
        </div>
        <p className="admin-sched__range muted">
          {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d, yyyy")}
        </p>

        {err ? <p className="form-message admin-sched__banner">{err}</p> : null}
        {loading ? <p className="muted">Loading…</p> : null}

        <div className="admin-sched__scroll">
          <div className="admin-sched__grid">
            <div className="admin-sched__corner" aria-hidden />
            {weekDays.map((d, i) => (
              <div key={format(d, "yyyy-MM-dd")} className="admin-sched__col-head" style={{ gridColumn: i + 2 }}>
                <span className="admin-sched__dow">{format(d, "EEE")}</span>
                <span className="admin-sched__dom">{format(d, "d MMM")}</span>
              </div>
            ))}

            <div className="admin-sched__hours">
              {hourRows.map((h) => (
                <div key={h} className="admin-sched__hour-label">
                  {format(setHours(startOfDay(new Date()), h), "h a")}
                </div>
              ))}
            </div>

            {weekDays.map((day, i) => {
              const key = format(day, "yyyy-MM-dd");
              const daySessions = sessionsByDayKey.get(key) ?? [];
              return (
                <div key={key} className="admin-sched__day-col" style={{ gridColumn: i + 2 }}>
                  {hourRows.map((h) => {
                    const slotStart = slotStartForCell(day, h);
                    const past = isSlotInPast(slotStart, new Date());
                    return (
                      <button
                        key={h}
                        type="button"
                        className={`admin-sched__slot${past ? " admin-sched__slot--past" : ""}`}
                        disabled={past}
                        aria-label={`Add session ${format(day, "EEE MMM d")} at ${format(slotStart, "h:mm a")}`}
                        onClick={() => openCreate(day, h)}
                      />
                    );
                  })}
                  <div className="admin-sched__events">
                    {daySessions.map((s) => {
                      const st = eventBlockStyle(s.startsAt, s.endsAt);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          className="admin-sched__event"
                          style={{ top: st.top, height: st.height }}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(s);
                          }}
                        >
                          <span className="admin-sched__event-title">{s.title}</span>
                          <span className="admin-sched__event-time">
                            {format(parseISO(s.startsAt), "h:mm a")} – {format(parseISO(s.endsAt), "h:mm a")}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {modal ? (
        <div className="admin-sched-modal" role="dialog" aria-modal="true" aria-labelledby="admin-sched-modal-title">
          <button type="button" className="admin-sched-modal__backdrop" aria-label="Close" onClick={closeModal} />
          <div className="admin-sched-modal__card card">
            <h3 id="admin-sched-modal-title">{modal.mode === "create" ? "New session" : "Edit session"}</h3>
            <p className="muted admin-sched-modal__when">
              <strong>Date:</strong> {format(modal.mode === "create" ? modal.slotStart : parseISO(modal.session.startsAt), "EEEE, MMM d, yyyy")}
              <br />
              <strong>Start:</strong>{" "}
              {format(modal.mode === "create" ? modal.slotStart : parseISO(modal.session.startsAt), "h:mm a")}
              {modal.mode === "edit" ? (
                <>
                  <br />
                  <span className="admin-sched-modal__hint">To move this session, delete it and add a new slot on the grid.</span>
                </>
              ) : null}
            </p>

            <div className="form-grid-responsive admin-form-grid--2">
              <label className="form-label">
                <span>Title (from group &amp; type)</span>
                <input className="input-field" readOnly value={computedTitle} />
              </label>
              <label className="form-label">
                <span>Age group</span>
                <select className="input-field" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)}>
                  {AGE_GROUPS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-label">
                <span>Type</span>
                <select className="input-field" value={kind} onChange={(e) => setKind(e.target.value as "training" | "match")}>
                  <option value="training">Training</option>
                  <option value="match">Match</option>
                </select>
              </label>
              <label className="form-label">
                <span>End time</span>
                <div className="admin-sched-modal__end-modes">
                  <label className="admin-sched-modal__radio">
                    <input
                      type="radio"
                      name="endMode"
                      checked={endMode === "duration"}
                      onChange={() => setEndMode("duration")}
                    />
                    Duration
                  </label>
                  <label className="admin-sched-modal__radio">
                    <input
                      type="radio"
                      name="endMode"
                      checked={endMode === "endTime"}
                      onChange={() => setEndMode("endTime")}
                    />
                    End time
                  </label>
                </div>
                {endMode === "duration" ? (
                  <select
                    className="input-field"
                    value={durationMins}
                    onChange={(e) => setDurationMins(Number(e.target.value))}
                  >
                    {DURATION_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {m} minutes
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    className="input-field"
                    value={endChoiceIdx}
                    onChange={(e) => setEndChoiceIdx(Number(e.target.value))}
                  >
                    {endChoices.map((c, i) => (
                      <option key={c.label} value={i}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                )}
              </label>
              <label className="form-label">
                <span>Location</span>
                <input
                  className="input-field"
                  list="admin-sched-locations"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                />
                <datalist id="admin-sched-locations">
                  {LOCATION_PRESETS.map((loc) => (
                    <option key={loc} value={loc} />
                  ))}
                </datalist>
              </label>
              <label className="form-label">
                <span>Kit / notes</span>
                <input className="input-field" value={kitRequirements} onChange={(e) => setKitRequirements(e.target.value)} />
              </label>
            </div>

            {err ? <p className="form-message">{err}</p> : null}

            <div className="admin-sched-modal__actions">
              <button type="button" className="btn" onClick={saveSession}>
                {modal.mode === "create" ? "Save session" : "Save changes"}
              </button>
              <button type="button" className="btn btn-secondary" onClick={closeModal}>
                Cancel
              </button>
              {modal.mode === "edit" ? (
                <button type="button" className="btn btn-secondary admin-sched-modal__delete" onClick={() => removeSession(modal.session.id)}>
                  Delete
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="card admin-sched-session-list">
        <h2 className="page-h2">All sessions</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Refreshes automatically when you add, edit, or delete from the grid.
        </p>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Group</th>
                <th>Start</th>
                <th>End</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const a = parseISO(s.startsAt);
                const b = parseISO(s.endsAt);
                return (
                  <tr key={s.id}>
                    <td>{s.title}</td>
                    <td>{s.ageGroup}</td>
                    <td>{isValid(a) ? format(a, "PPp") : s.startsAt}</td>
                    <td>{isValid(b) ? format(b, "PPp") : s.endsAt}</td>
                    <td>
                      {s.isUpdated ? <span className="weekly-cal__updated-pill">Updated</span> : <span className="muted">—</span>}
                      {s.updatedAt ? (
                        <span className="muted" style={{ display: "block", fontSize: "0.78rem", marginTop: "0.25rem" }}>
                          {format(parseISO(s.updatedAt), "PPp")}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
