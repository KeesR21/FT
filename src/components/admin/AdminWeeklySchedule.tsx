"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addDays,
  differenceInMinutes,
  format,
  isMonday,
  isToday,
  isValid,
  parseISO,
  setHours,
  setMinutes
} from "date-fns";
import { AGE_GROUPS } from "@/lib/age-groups";
import type { AgeGroup } from "@/lib/age-groups";
import { adminApiFetch, parseAdminApiBody, readAdminApiError } from "@/lib/admin-api-fetch";
import { findSessionConflicts } from "@/lib/weekly-schedule/conflicts";
import { SCHEDULE_TEAMS } from "@/lib/weekly-schedule/api-schema";
import { sessionTypeLabel } from "@/lib/weekly-schedule/labels";
import { usePortalAuthNotify } from "@/components/portal/portal-auth-notify";
import type {
  AdminVersionDetail,
  AdminWeekSummary,
  ScheduleCoach,
  SchedulePitch,
  ScheduleSession,
  ScheduleSessionInput,
  ScheduleSessionType
} from "@/lib/weekly-schedule/types";

// ─────────────────────────────────────────────────────────────────────────────
// Constants & shared types
// ─────────────────────────────────────────────────────────────────────────────

const DAY_ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday"
] as const;
type DayName = (typeof DAY_ORDER)[number];

type SessionColors = { bg: string; border: string; badge: string };
const SESSION_COLORS: Record<ScheduleSessionType, SessionColors> = {
  training: { bg: "rgba(59,130,246,0.07)", border: "#3b82f6", badge: "#2563eb" },
  match: { bg: "rgba(16,185,129,0.07)", border: "#10b981", badge: "#059669" },
  rest: { bg: "rgba(245,158,11,0.07)", border: "#f59e0b", badge: "#d97706" }
};

type SessionFormState = {
  type: ScheduleSessionType;
  startsAt: string;
  endsAt: string;
  ageGroups: string[];
  coachIds: string[];
  pitchId: string;
  period: "morning" | "afternoon";
  trainingTopic: string;
  objectives: string;
  kit: string;
  teamA: string;
  teamB: string;
  matchNotes: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────────────────

function toLocalInput(iso: string): string {
  const d = parseISO(iso);
  if (!isValid(d)) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Extract "yyyy-MM-dd" from a local datetime string "yyyy-MM-ddTHH:mm". */
function datePart(local: string): string {
  return local.split("T")[0] ?? "";
}

/** Extract "HH:mm" from a local datetime string "yyyy-MM-ddTHH:mm". */
function timePart(local: string): string {
  return local.split("T")[1] ?? "00:00";
}

/** Combine a date ("yyyy-MM-dd") and a time ("HH:mm") into a local datetime string. */
function combineDateTime(date: string, time: string): string {
  if (!date) return "";
  return `${date}T${time || "00:00"}`;
}

/**
 * Derive session period from a "HH:mm" time string.
 * 00:00–11:59 → morning · 12:00–17:59 → afternoon · 18:00+ → evening
 * The API only stores "morning"|"afternoon"; evening maps to "afternoon" for storage.
 */
function derivePeriod(time: string): "morning" | "afternoon" {
  const hour = parseInt(time.split(":")[0] ?? "12", 10);
  return hour < 12 ? "morning" : "afternoon";
}

type PeriodDisplay = {
  label: string;
  key: "morning" | "afternoon" | "evening";
};

function derivePeriodDisplay(time: string): PeriodDisplay {
  const hour = parseInt(time.split(":")[0] ?? "12", 10);
  if (hour < 12) return { label: "Morning", key: "morning" };
  if (hour < 18) return { label: "Afternoon", key: "afternoon" };
  return { label: "Evening", key: "evening" };
}

/** Generate time options "HH:mm" from startHour to endHour (inclusive) in minuteStep increments. */
function generateTimeOptions(startHour = 6, endHour = 22, minuteStep = 15): string[] {
  const options: string[] = [];
  for (let h = startHour; h <= endHour; h++) {
    for (let m = 0; m < 60; m += minuteStep) {
      if (h === endHour && m > 0) break;
      options.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return options;
}

const TIME_OPTIONS = generateTimeOptions(6, 22, 15);

function fromLocalInput(value: string): string {
  if (!value) return "";
  return new Date(value).toISOString();
}

function sessionDayName(startsAt: string): DayName {
  const d = parseISO(startsAt);
  return (isValid(d) ? format(d, "EEEE") : "Monday") as DayName;
}

function buildPayload(form: SessionFormState): ScheduleSessionInput {
  const base = {
    startsAt: fromLocalInput(form.startsAt),
    endsAt: fromLocalInput(form.endsAt),
    pitchId: form.pitchId,
    coachIds: form.coachIds,
    ageGroups: form.ageGroups.filter((g): g is AgeGroup =>
      (AGE_GROUPS as readonly string[]).includes(g)
    ),
    period: form.period,
    trainingTopic: form.trainingTopic,
    objectives: form.objectives,
    kit: form.kit,
    teamA: form.teamA,
    teamB: form.teamB,
    matchNotes: form.matchNotes
  };
  if (form.type === "match") {
    return { ...base, type: "match", trainingTopic: "", objectives: "", kit: "" };
  }
  return { ...base, type: form.type, teamA: "", teamB: "" };
}

function makeDefaultForm(
  dayName: DayName,
  weekStart: string,
  coaches: ScheduleCoach[],
  pitches: SchedulePitch[]
): SessionFormState {
  const idx = DAY_ORDER.indexOf(dayName);
  const base = addDays(parseISO(`${weekStart}T12:00:00`), idx);
  const start = setMinutes(setHours(base, 16), 0);
  const end = setMinutes(setHours(base, 17), 30);
  return {
    type: "training",
    startsAt: toLocalInput(start.toISOString()),
    endsAt: toLocalInput(end.toISOString()),
    ageGroups: ["U9"],
    coachIds: coaches.find((c) => c.active) ? [coaches.find((c) => c.active)!.id] : [],
    pitchId: pitches.find((p) => p.active)?.id ?? "",
    period: "afternoon",
    trainingTopic: "",
    objectives: "",
    kit: "",
    teamA: "U9",
    teamB: "Guest XI",
    matchNotes: ""
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function TtSpinner() {
  return <span className="tt-spinner" aria-hidden />;
}

function TtSkeleton() {
  return <div className="tt-card-skeleton" aria-hidden />;
}

interface SessionCardProps {
  session: ScheduleSession;
  isSelected: boolean;
  isEditable: boolean;
  isBusy: boolean;
  coaches: ScheduleCoach[];
  pitches: SchedulePitch[];
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

function SessionCard({
  session,
  isSelected,
  isEditable,
  isBusy,
  coaches,
  pitches,
  onClick,
  onDragStart,
  onDragOver,
  onDrop
}: SessionCardProps) {
  const start = parseISO(session.startsAt);
  const end = parseISO(session.endsAt);
  const timeStr =
    isValid(start) && isValid(end)
      ? `${format(start, "HH:mm")} – ${format(end, "HH:mm")}`
      : "—";
  const colors = SESSION_COLORS[session.type];
  const pitch = pitches.find((p) => p.id === session.pitchId);
  const coachNames = coaches
    .filter((c) => session.coachIds.includes(c.id))
    .map((c) => c.name);
  const mainLabel =
    session.type === "match"
      ? `${session.teamA} vs ${session.teamB}`
      : session.ageGroups.join(" · ") || "All groups";

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={isEditable}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      aria-pressed={isSelected}
      className={[
        "tt-card",
        isSelected ? "tt-card--selected" : "",
        isBusy ? "tt-card--busy" : ""
      ]
        .filter(Boolean)
        .join(" ")}
      style={
        {
          "--tt-accent": colors.border,
          "--tt-bg": colors.bg
        } as React.CSSProperties
      }
    >
      <span className="tt-card__badge" style={{ background: colors.badge }}>
        {sessionTypeLabel(session.type)}
      </span>
      <p className="tt-card__time">{timeStr}</p>
      <p className="tt-card__label">{mainLabel}</p>
      {session.trainingTopic && (
        <p className="tt-card__topic">{session.trainingTopic}</p>
      )}
      {pitch && <p className="tt-card__meta">{pitch.name}</p>}
      {coachNames.length > 0 && (
        <p className="tt-card__meta">{coachNames.join(", ")}</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function AdminWeeklySchedule() {
  const notify = usePortalAuthNotify();

  // ── data ──────────────────────────────────────────────────────────────────
  const [weeks, setWeeks] = useState<AdminWeekSummary[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminVersionDetail | null>(null);
  const [coaches, setCoaches] = useState<ScheduleCoach[]>([]);
  const [pitches, setPitches] = useState<SchedulePitch[]>([]);

  // ── loading / saving states ────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // ── drawer ────────────────────────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<DayName>("Monday");
  const [selectedSessionId, setSelectedSessionId] = useState<
    string | "new" | null
  >(null);
  const [form, setForm] = useState<SessionFormState | null>(null);

  // ── modals / panels ───────────────────────────────────────────────────────
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDiscardDraft, setConfirmDiscardDraft] = useState(false);
  const [confirmDeleteWeek, setConfirmDeleteWeek] = useState(false);
  const [showNewWeekModal, setShowNewWeekModal] = useState(false);
  const [newWeekStart, setNewWeekStart] = useState("");
  const [showWeekList, setShowWeekList] = useState(false);
  const [showDupPanel, setShowDupPanel] = useState(false);
  const [dupFrom, setDupFrom] = useState<DayName>("Monday");
  const [dupTo, setDupTo] = useState<DayName>("Tuesday");

  // ── drag state ────────────────────────────────────────────────────────────
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const weekListRef = useRef<HTMLDivElement>(null);

  // ── derived ───────────────────────────────────────────────────────────────
  const summary = weeks.find((w) => w.week.id === selectedWeekId) ?? null;
  const weekIndex = weeks.findIndex((w) => w.week.id === selectedWeekId);

  const sessionsByDay = useMemo(() => {
    const map = new Map<DayName, ScheduleSession[]>();
    for (const d of DAY_ORDER) map.set(d, []);
    if (!detail) return map;
    for (const s of detail.sessions) {
      const day = sessionDayName(s.startsAt);
      map.get(day)?.push(s);
    }
    for (const list of map.values())
      list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return map;
  }, [detail]);

  const publishConflicts = useMemo(() => {
    if (!detail) return [] as string[];
    const out = new Set<string>();
    for (const s of detail.sessions)
      for (const c of findSessionConflicts(detail.sessions, s, s.id))
        out.add(c.reason);
    return [...out];
  }, [detail]);

  const formConflicts = useMemo(() => {
    if (!detail || !form) return [] as string[];
    const candidate = buildPayload(form);
    const excl =
      selectedSessionId && selectedSessionId !== "new"
        ? selectedSessionId
        : undefined;
    return findSessionConflicts(detail.sessions, candidate, excl).map(
      (c) => c.reason
    );
  }, [detail, form, selectedSessionId]);

  const isBusy = saving || publishing;

  // ── API: load meta (coaches + pitches) ───────────────────────────────────
  const loadMeta = useCallback(async () => {
    const [cR, pR] = await Promise.all([
      fetch("/api/admin/schedule/coaches", { credentials: "include" }),
      fetch("/api/admin/schedule/pitches", { credentials: "include" })
    ]);
    if (cR.ok)
      setCoaches(((await cR.json()) as { coaches: ScheduleCoach[] }).coaches);
    if (pR.ok)
      setPitches(((await pR.json()) as { pitches: SchedulePitch[] }).pitches);
  }, []);

  // ── API: load weeks list ─────────────────────────────────────────────────
  const loadWeeks = useCallback(
    async (keepSelected = false): Promise<AdminWeekSummary[]> => {
      setLoading(true);
      try {
        const r = await fetch("/api/admin/schedule/weeks", {
          credentials: "include",
          cache: "no-store"
        });
        if (!r.ok) throw new Error(await readAdminApiError(r));
        const data = (await r.json()) as { weeks: AdminWeekSummary[] };
        setWeeks(data.weeks);
        if (!keepSelected && !selectedWeekId && data.weeks[0]) {
          setSelectedWeekId(data.weeks[0].week.id);
        }
        return data.weeks;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to load schedule";
        notify.error(msg);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [selectedWeekId, notify]
  );

  // ── API: load version detail ─────────────────────────────────────────────
  const loadDetail = useCallback(
    async (weekId: string, wks: AdminWeekSummary[]) => {
      const ws = wks.find((w) => w.week.id === weekId);
      if (!ws) return;
      const vId = ws.draftVersion?.id ?? ws.activeVersion?.id;
      if (!vId) {
        setDetail(null);
        return;
      }
      const r = await fetch(`/api/admin/schedule/versions/${vId}`, {
        credentials: "include",
        cache: "no-store"
      });
      if (!r.ok) return;
      const data = (await r.json()) as { detail: AdminVersionDetail };
      setDetail(data.detail);
    },
    []
  );

  // ── API: refresh ─────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    const wks = await loadWeeks(true);
    if (selectedWeekId) await loadDetail(selectedWeekId, wks);
  }, [loadWeeks, loadDetail, selectedWeekId]);

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([loadMeta(), loadWeeks()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedWeekId) loadDetail(selectedWeekId, weeks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeekId]);

  // ── Ensure editable version ───────────────────────────────────────────────
  async function ensureEditable(): Promise<AdminVersionDetail | null> {
    if (!summary) return null;
    if (detail?.isEditable) return detail;
    const r = await adminApiFetch(
      `/api/admin/schedule/weeks/${summary.week.id}/update`,
      { method: "POST" }
    );
    if (!r.ok) {
      const msg = await readAdminApiError(r);
      notify.error(msg);
      return null;
    }
    const wks = await loadWeeks(true);
    const latest = wks.find((w) => w.week.id === summary.week.id);
    const vId = latest?.draftVersion?.id ?? latest?.activeVersion?.id;
    if (!vId) return null;
    const dr = await fetch(`/api/admin/schedule/versions/${vId}`, {
      credentials: "include",
      cache: "no-store"
    });
    if (!dr.ok) return null;
    const d = (await dr.json()) as { detail: AdminVersionDetail };
    setDetail(d.detail);
    return d.detail;
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  async function createWeek() {
    const d = parseISO(`${newWeekStart}T12:00:00`);
    if (!isValid(d) || !isMonday(d)) {
      notify.error("Please pick a Monday as the week start date.");
      return;
    }
    setSaving(true);
    try {
      const r = await adminApiFetch("/api/admin/schedule/weeks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart: newWeekStart })
      });
      const parsed = await parseAdminApiBody<{ week: { id: string } }>(r);
      if (!parsed.ok) throw new Error(parsed.message);
      setNewWeekStart("");
      setShowNewWeekModal(false);
      const wks = await loadWeeks(false);
      setSelectedWeekId(parsed.data.week.id);
      await loadDetail(parsed.data.week.id, wks);
      notify.success("New week created.");
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Failed to create week.");
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!detail) return;
    if (publishConflicts.length > 0) {
      notify.error("Resolve conflicts before publishing.");
      return;
    }
    if (detail.sessions.length === 0) {
      notify.error("Add at least one session before publishing.");
      return;
    }
    setPublishing(true);
    try {
      const r = await adminApiFetch(
        `/api/admin/schedule/versions/${detail.version.id}/publish`,
        { method: "POST" }
      );
      const parsed = await parseAdminApiBody<unknown>(r);
      if (!parsed.ok) throw new Error(parsed.message);
      await refresh();
      notify.success("Schedule published successfully.");
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Failed to publish.");
    } finally {
      setPublishing(false);
    }
  }

  async function saveSession() {
    if (!detail || !form) return;
    if (formConflicts.length > 0) {
      notify.error("Resolve conflicts before saving.");
      return;
    }
    setSaving(true);
    try {
      const editable = await ensureEditable();
      if (!editable) return;
      const isNew = selectedSessionId === "new";
      const url = isNew
        ? `/api/admin/schedule/versions/${editable.version.id}/sessions`
        : `/api/admin/schedule/versions/${editable.version.id}/sessions/${selectedSessionId}`;
      const r = await adminApiFetch(url, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(form))
      });
      const parsed = await parseAdminApiBody<unknown>(r);
      if (!parsed.ok) throw new Error(parsed.message);
      await refresh();
      closeDrawer();
      notify.success(isNew ? "Session added." : "Session updated.");
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Failed to save session.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSession(sessionId: string) {
    setSaving(true);
    try {
      const editable = await ensureEditable();
      if (!editable) return;
      const r = await adminApiFetch(
        `/api/admin/schedule/versions/${editable.version.id}/sessions/${sessionId}`,
        { method: "DELETE" }
      );
      if (!r.ok) throw new Error(await readAdminApiError(r));
      await refresh();
      setConfirmDeleteId(null);
      closeDrawer();
      notify.success("Session deleted.");
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Failed to delete session.");
    } finally {
      setSaving(false);
    }
  }

  async function clearWeek() {
    if (!detail) return;
    setSaving(true);
    try {
      const editable = await ensureEditable();
      if (!editable) return;
      await Promise.all(
        editable.sessions.map((s) =>
          adminApiFetch(
            `/api/admin/schedule/versions/${editable.version.id}/sessions/${s.id}`,
            { method: "DELETE" }
          )
        )
      );
      await refresh();
      closeDrawer();
      notify.success("All sessions cleared.");
    } catch (e) {
      notify.error(
        e instanceof Error ? e.message : "Could not clear week."
      );
    } finally {
      setSaving(false);
    }
  }

  /** Discard the current draft version (only works when there is an active version to fall back to). */
  async function discardDraft() {
    if (!detail?.isDraft) return;
    setSaving(true);
    try {
      const r = await adminApiFetch(
        `/api/admin/schedule/versions/${detail.version.id}`,
        { method: "DELETE" }
      );
      if (!r.ok) throw new Error(await readAdminApiError(r));
      await refresh();
      closeDrawer();
      notify.success("Draft discarded. Showing published schedule.");
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Failed to discard draft.");
    } finally {
      setSaving(false);
    }
  }

  /** Delete the entire week and all its sessions/versions permanently. */
  async function deleteWholeWeek() {
    if (!summary) return;
    setSaving(true);
    try {
      const r = await adminApiFetch(
        `/api/admin/schedule/weeks/${summary.week.id}`,
        { method: "DELETE" }
      );
      if (!r.ok) throw new Error(await readAdminApiError(r));
      closeDrawer();
      setDetail(null);
      setSelectedWeekId(null);
      await loadWeeks(false);
      notify.success("Week deleted successfully.");
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Failed to delete week.");
    } finally {
      setSaving(false);
    }
  }

  async function copyPreviousWeek() {
    if (!detail) return;
    const prev = weeks
      .filter((w) => w.week.weekStart < detail.week.weekStart)
      .sort((a, b) => b.week.weekStart.localeCompare(a.week.weekStart))[0];
    if (!prev) {
      notify.error("No previous week found to copy from.");
      return;
    }
    const srcVId = prev.activeVersion?.id ?? prev.draftVersion?.id;
    if (!srcVId) {
      notify.error("Previous week has no schedule to copy.");
      return;
    }
    setSaving(true);
    try {
      const editable = await ensureEditable();
      if (!editable) return;
      const srcR = await fetch(`/api/admin/schedule/versions/${srcVId}`, {
        credentials: "include",
        cache: "no-store"
      });
      if (!srcR.ok) throw new Error("Could not load source week.");
      const { detail: src } = (await srcR.json()) as {
        detail: AdminVersionDetail;
      };
      for (const s of src.sessions) {
        const start = parseISO(s.startsAt);
        const end = parseISO(s.endsAt);
        const day = format(start, "EEEE");
        const tgt = addDays(
          parseISO(`${editable.week.weekStart}T12:00:00`),
          DAY_ORDER.indexOf(day as DayName)
        );
        const ns = setMinutes(setHours(tgt, start.getHours()), start.getMinutes());
        const ne = new Date(ns.getTime() + differenceInMinutes(end, start) * 60000);
        const r = await adminApiFetch(
          `/api/admin/schedule/versions/${editable.version.id}/sessions`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...s, startsAt: ns.toISOString(), endsAt: ne.toISOString() } as ScheduleSessionInput)
          }
        );
        if (!r.ok) throw new Error(await readAdminApiError(r));
      }
      await refresh();
      notify.success(`Copied from ${prev.weekRangeLabel}.`);
    } catch (e) {
      notify.error(
        e instanceof Error ? e.message : "Could not copy previous week."
      );
    } finally {
      setSaving(false);
    }
  }

  async function duplicateDay() {
    if (!detail) return;
    setSaving(true);
    try {
      const editable = await ensureEditable();
      if (!editable) return;
      const src = editable.sessions.filter(
        (s) => sessionDayName(s.startsAt) === dupFrom
      );
      if (src.length === 0) {
        notify.error(`No sessions on ${dupFrom} to duplicate.`);
        return;
      }
      for (const s of src) {
        const start = parseISO(s.startsAt);
        const end = parseISO(s.endsAt);
        const tgt = addDays(
          parseISO(`${editable.week.weekStart}T12:00:00`),
          DAY_ORDER.indexOf(dupTo)
        );
        const ns = setMinutes(setHours(tgt, start.getHours()), start.getMinutes());
        const ne = new Date(ns.getTime() + differenceInMinutes(end, start) * 60000);
        const r = await adminApiFetch(
          `/api/admin/schedule/versions/${editable.version.id}/sessions`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...s, startsAt: ns.toISOString(), endsAt: ne.toISOString() } as ScheduleSessionInput)
          }
        );
        if (!r.ok) throw new Error(await readAdminApiError(r));
      }
      await refresh();
      setShowDupPanel(false);
      notify.success(`Duplicated ${dupFrom} → ${dupTo}.`);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Could not duplicate day.");
    } finally {
      setSaving(false);
    }
  }

  async function moveSession(
    sessionId: string,
    toDay: DayName,
    anchorStartsAt?: string
  ) {
    if (!detail) return;
    setSaving(true);
    try {
      const editable = await ensureEditable();
      if (!editable) return;
      const cur = editable.sessions.find((s) => s.id === sessionId);
      if (!cur) return;
      const start = parseISO(cur.startsAt);
      const end = parseISO(cur.endsAt);
      const dur = differenceInMinutes(end, start);
      const anchor = anchorStartsAt ? parseISO(anchorStartsAt) : start;
      const tgt = addDays(
        parseISO(`${editable.week.weekStart}T12:00:00`),
        DAY_ORDER.indexOf(toDay)
      );
      const ns = setMinutes(setHours(tgt, anchor.getHours()), anchor.getMinutes());
      const ne = new Date(ns.getTime() + dur * 60000);
      const r = await adminApiFetch(
        `/api/admin/schedule/versions/${editable.version.id}/sessions/${sessionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...cur,
            startsAt: ns.toISOString(),
            endsAt: ne.toISOString()
          } as ScheduleSessionInput)
        }
      );
      if (!r.ok) throw new Error(await readAdminApiError(r));
      await refresh();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Failed to move session.");
    } finally {
      setSaving(false);
    }
  }

  // ── Drawer helpers ────────────────────────────────────────────────────────

  function closeDrawer() {
    setDrawerOpen(false);
    setSelectedSessionId(null);
    setForm(null);
  }

  function openNewForDay(dayName: DayName) {
    if (!detail) return;
    setSelectedDay(dayName);
    setSelectedSessionId("new");
    setForm(makeDefaultForm(dayName, detail.week.weekStart, coaches, pitches));
    setDrawerOpen(true);
  }

  function openEditor(session: ScheduleSession) {
    setSelectedSessionId(session.id);
    setSelectedDay(sessionDayName(session.startsAt));
    setForm({
      type: session.type,
      startsAt: toLocalInput(session.startsAt),
      endsAt: toLocalInput(session.endsAt),
      ageGroups: [...session.ageGroups],
      coachIds: [...session.coachIds],
      pitchId: session.pitchId,
      period: session.period,
      trainingTopic: session.trainingTopic,
      objectives: session.objectives,
      kit: session.kit,
      teamA: session.teamA || "U9",
      teamB: session.teamB || "Guest XI",
      matchNotes: session.matchNotes
    });
    setDrawerOpen(true);
  }

  function toggleGroup(g: string) {
    setForm((f) => {
      if (!f) return f;
      const has = f.ageGroups.includes(g);
      return {
        ...f,
        ageGroups: has ? f.ageGroups.filter((x) => x !== g) : [...f.ageGroups, g]
      };
    });
  }

  function toggleCoach(id: string, required = true) {
    setForm((f) => {
      if (!f) return f;
      const has = f.coachIds.includes(id);
      let ids = has ? f.coachIds.filter((x) => x !== id) : [...f.coachIds, id];
      if (required && !ids.length) {
        const fb = coaches.find((c) => c.active)?.id;
        if (fb) ids = [fb];
      }
      return { ...f, coachIds: ids };
    });
  }

  // ── Status badge ──────────────────────────────────────────────────────────

  /** Compute a rich status for a week based on its publish state and real calendar position. */
  function computeWeekStatus(w: AdminWeekSummary): {
    label: string;
    cls: "tt-status--live" | "tt-status--scheduled" | "tt-status--expired" | "tt-status--draft" | "tt-status--none";
  } {
    const today = format(new Date(), "yyyy-MM-dd");
    const weekEnd = format(addDays(parseISO(`${w.week.weekStart}T00:00:00`), 6), "yyyy-MM-dd");
    const isCurrentWeek = w.week.weekStart <= today && weekEnd >= today;
    const isFuture = w.week.weekStart > today;
    const isPast = weekEnd < today;

    if (!w.activeVersion) {
      return { label: w.draftVersion ? "Draft" : "Unpublished", cls: "tt-status--draft" };
    }
    if (w.hasUnpublishedDraft) return { label: "Draft pending", cls: "tt-status--draft" };
    if (isCurrentWeek) return { label: "Live", cls: "tt-status--live" };
    if (isFuture)      return { label: "Scheduled", cls: "tt-status--scheduled" };
    if (isPast)        return { label: "Expired", cls: "tt-status--expired" };
    return { label: "Published", cls: "tt-status--live" };
  }

  const currentStatus = summary ? computeWeekStatus(summary) : null;

  // ── "Missing live schedule" banner ────────────────────────────────────────
  // Warn when no published schedule exists for the current calendar week.
  const currentWeekMissing = useMemo(() => {
    if (loading || weeks.length === 0) return false;
    const today = format(new Date(), "yyyy-MM-dd");
    return !weeks.some((w) => {
      const weekEnd = format(addDays(parseISO(`${w.week.weekStart}T00:00:00`), 6), "yyyy-MM-dd");
      return w.week.weekStart <= today && weekEnd >= today && w.activeVersion !== null;
    });
  }, [weeks, loading]);

  // Day date label helpers
  function dayDate(d: DayName): string {
    if (!detail) return "";
    const date = addDays(parseISO(`${detail.week.weekStart}T12:00:00`), DAY_ORDER.indexOf(d));
    return isValid(date) ? format(date, "d MMM") : "";
  }
  function isCurrentDay(d: DayName): boolean {
    if (!detail) return false;
    const date = addDays(parseISO(`${detail.week.weekStart}T12:00:00`), DAY_ORDER.indexOf(d));
    return isValid(date) && isToday(date);
  }
  /** True when the day is before today — no new sessions can be added. */
  function isPastDay(d: DayName): boolean {
    if (!detail) return false;
    const date = addDays(parseISO(`${detail.week.weekStart}T00:00:00`), DAY_ORDER.indexOf(d));
    return isValid(date) && date < new Date(new Date().setHours(0, 0, 0, 0));
  }

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div className="tt-root">
      {/* ── Page header bar ─────────────────────────────────────────────── */}
      <div className="tt-header card">
        {/* Week navigation */}
        <div className="tt-header__nav">
          <button
            type="button"
            className="tt-icon-btn"
            aria-label="Previous week"
            disabled={weekIndex <= 0 || isBusy}
            onClick={() =>
              weekIndex > 0 && setSelectedWeekId(weeks[weekIndex - 1]!.week.id)
            }
          >
            ‹
          </button>

          <div className="tt-week-selector">
            <button
              type="button"
              className="tt-week-label"
              onClick={() => setShowWeekList((v) => !v)}
              aria-expanded={showWeekList}
              aria-haspopup="listbox"
            >
              <span className="tt-week-label__text">
                {summary?.weekRangeLabel ?? detail?.weekRangeLabel ?? "Select a week"}
              </span>
              <span className="tt-week-label__caret">{showWeekList ? "▲" : "▼"}</span>
            </button>

            {showWeekList && (
              <div className="tt-week-dropdown" ref={weekListRef} role="listbox">
                {weeks.map((w) => {
                  const ws = computeWeekStatus(w);
                  return (
                    <button
                      key={w.week.id}
                      type="button"
                      role="option"
                      aria-selected={w.week.id === selectedWeekId}
                      className={`tt-week-opt${w.week.id === selectedWeekId ? " tt-week-opt--active" : ""}`}
                      onClick={() => {
                        setSelectedWeekId(w.week.id);
                        setShowWeekList(false);
                      }}
                    >
                      <span>{w.weekRangeLabel}</span>
                      <span className={`tt-badge tt-badge--${ws.cls.replace("tt-status--", "")}`}>
                        {ws.label}
                      </span>
                    </button>
                  );
                })}
                {weeks.length === 0 && (
                  <p className="tt-week-dropdown__empty muted">No weeks yet</p>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            className="tt-icon-btn"
            aria-label="Next week"
            disabled={weekIndex >= weeks.length - 1 || weekIndex < 0 || isBusy}
            onClick={() =>
              weekIndex < weeks.length - 1 &&
              setSelectedWeekId(weeks[weekIndex + 1]!.week.id)
            }
          >
            ›
          </button>
        </div>

        {/* Status + actions */}
        <div className="tt-header__right">
          {currentStatus && (
            <span className={`tt-status ${currentStatus.cls}`}>{currentStatus.label}</span>
          )}

          {detail?.updatedOnLabel && (
            <span className="tt-header__meta">
              Updated {detail.updatedOnLabel}
            </span>
          )}

          {detail && !detail.isEditable && (
            <button
              type="button"
              className="tt-btn tt-btn--secondary"
              disabled={isBusy}
              onClick={async () => {
                setSaving(true);
                await ensureEditable();
                setSaving(false);
              }}
            >
              {saving ? <TtSpinner /> : null} Edit schedule
            </button>
          )}

          {detail?.isEditable && (
            <button
              type="button"
              className={`tt-btn${publishConflicts.length > 0 ? " tt-btn--disabled" : ""}`}
              disabled={isBusy || publishConflicts.length > 0}
              onClick={publish}
              title={
                publishConflicts.length > 0
                  ? "Fix conflicts first"
                  : "Publish this schedule"
              }
            >
              {publishing ? (
                <>
                  <TtSpinner /> Publishing…
                </>
              ) : (
                "Publish schedule"
              )}
            </button>
          )}

          <button
            type="button"
            className="tt-btn tt-btn--outline"
            onClick={() => setShowNewWeekModal(true)}
          >
            + New week
          </button>

          {/* Delete whole week */}
          {summary && (
            <button
              type="button"
              className="tt-btn tt-btn--ghost tt-btn--red"
              disabled={isBusy}
              onClick={() => setConfirmDeleteWeek(true)}
              title="Delete this entire week schedule permanently"
            >
              Delete week
            </button>
          )}
        </div>
      </div>

      {/* ── Missing live schedule banner ──────────────────────────────────── */}
      {currentWeekMissing && !loading && (
        <div className="tt-missing-banner" role="alert">
          <span className="tt-missing-banner__icon">⚠️</span>
          <div className="tt-missing-banner__body">
            <strong>No active schedule for this week.</strong>
            <span>
              {" "}You can still create and immediately publish a schedule for the remaining days of this week.
            </span>
          </div>
          <button
            type="button"
            className="tt-btn tt-btn--primary tt-btn--sm"
            onClick={() => setShowNewWeekModal(true)}
          >
            Create schedule
          </button>
        </div>
      )}

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      {detail && (
        <div className="tt-toolbar">
          <div className="tt-toolbar__left">
            {detail.isDraft && (
              <span className="tt-toolbar__pill tt-toolbar__pill--draft">
                Editing draft v{detail.version.versionNumber}
              </span>
            )}
            {publishConflicts.length > 0 && (
              <span className="tt-toolbar__pill tt-toolbar__pill--warn">
                ⚠ {publishConflicts.length} conflict
                {publishConflicts.length > 1 ? "s" : ""} — fix before publishing
              </span>
            )}
          </div>
          <div className="tt-toolbar__right">
            {detail.isEditable && (
              <button
                type="button"
                className="tt-btn tt-btn--ghost tt-btn--sm"
                disabled={isBusy}
                onClick={copyPreviousWeek}
              >
                Copy previous week
              </button>
            )}
            {detail.isEditable && (
              <button
                type="button"
                className={`tt-btn tt-btn--ghost tt-btn--sm${showDupPanel ? " tt-btn--active" : ""}`}
                onClick={() => setShowDupPanel((v) => !v)}
              >
                Duplicate day
              </button>
            )}
            {detail.isEditable && detail.sessions.length > 0 && (
              <button
                type="button"
                className="tt-btn tt-btn--ghost tt-btn--sm tt-btn--red"
                disabled={isBusy}
                onClick={() => {
                  if (
                    confirm(
                      "Clear ALL sessions in this draft? This cannot be undone."
                    )
                  )
                    void clearWeek();
                }}
              >
                Clear week
              </button>
            )}
            {/* Discard draft — only available when there's an active version to fall back to */}
            {detail.isEditable && summary?.activeVersion && (
              <button
                type="button"
                className="tt-btn tt-btn--ghost tt-btn--sm tt-btn--red"
                disabled={isBusy}
                onClick={() => setConfirmDiscardDraft(true)}
              >
                Discard draft
              </button>
            )}
            {detail.isEditable && (
              <button
                type="button"
                className="tt-btn tt-btn--sm"
                disabled={isBusy}
                onClick={() => openNewForDay(selectedDay)}
              >
                + Add session
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Duplicate day panel ───────────────────────────────────────────── */}
      {showDupPanel && detail && (
        <div className="tt-dup-panel card">
          <span className="tt-dup-panel__label">Duplicate sessions from</span>
          <select
            className="tt-select"
            value={dupFrom}
            onChange={(e) => setDupFrom(e.target.value as DayName)}
          >
            {DAY_ORDER.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <span className="tt-dup-panel__arrow">→</span>
          <select
            className="tt-select"
            value={dupTo}
            onChange={(e) => setDupTo(e.target.value as DayName)}
          >
            {DAY_ORDER.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="tt-btn tt-btn--sm"
            disabled={isBusy || dupFrom === dupTo}
            onClick={duplicateDay}
          >
            {saving ? <TtSpinner /> : null} Apply
          </button>
          <button
            type="button"
            className="tt-btn tt-btn--ghost tt-btn--sm"
            onClick={() => setShowDupPanel(false)}
          >
            Cancel
          </button>
        </div>
      )}

      {/* ── Conflict banner ───────────────────────────────────────────────── */}
      {publishConflicts.length > 0 && (
        <div className="tt-conflict-banner">
          <strong>Cannot publish — resolve these conflicts:</strong>
          <ul>
            {publishConflicts.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Loading skeleton ──────────────────────────────────────────────── */}
      {loading && (
        <div className="tt-grid">
          {DAY_ORDER.map((d) => (
            <div key={d} className="tt-col">
              <div className="tt-col__head">
                <span className="tt-col__day">{d.slice(0, 3).toUpperCase()}</span>
                <span
                  className="tt-skeleton"
                  style={{ width: "2.5rem", height: "0.9rem", borderRadius: "4px" }}
                />
              </div>
              {[1, 2].map((i) => (
                <TtSkeleton key={i} />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {!loading && !detail && (
        <div className="tt-empty card">
          <div className="tt-empty__icon" aria-hidden>
            📅
          </div>
          <h2 className="tt-empty__title">No week selected</h2>
          <p className="tt-empty__sub">
            Select a week from the navigator or create the first schedule week.
          </p>
          <button
            type="button"
            className="tt-btn"
            onClick={() => setShowNewWeekModal(true)}
          >
            + Create first week
          </button>
        </div>
      )}

      {/* ── Calendar grid ─────────────────────────────────────────────────── */}
      {!loading && detail && (
        <div className="tt-grid" aria-label="Weekly schedule calendar">
          {DAY_ORDER.map((dayName) => {
            const sessions = sessionsByDay.get(dayName) ?? [];
            const today = isCurrentDay(dayName);
            const past  = isPastDay(dayName);
            return (
              <div
                key={dayName}
                className={`tt-col${today ? " tt-col--today" : ""}${past ? " tt-col--past" : ""}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={async (e) => {
                  e.preventDefault();
                  const sid =
                    e.dataTransfer.getData("text/plain") || draggingId;
                  if (sid) await moveSession(sid, dayName);
                  setDraggingId(null);
                }}
              >
                {/* Column header */}
                <div className="tt-col__head">
                  <span className="tt-col__day">
                    {dayName.slice(0, 3).toUpperCase()}
                    {today && <span className="tt-col__dot" aria-label="Today" />}
                  </span>
                  <span className="tt-col__date">{dayDate(dayName)}</span>
                  {past && <span className="tt-col__past-label">Past</span>}
                </div>

                {/* Session cards */}
                <div className="tt-col__body">
                  {sessions.map((s) => (
                    <SessionCard
                      key={s.id}
                      session={s}
                      isSelected={selectedSessionId === s.id}
                      isEditable={detail.isEditable}
                      isBusy={isBusy}
                      coaches={coaches}
                      pitches={pitches}
                      onClick={() => openEditor(s)}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", s.id);
                        setDraggingId(s.id);
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={async (e) => {
                        e.preventDefault();
                        const sid =
                          e.dataTransfer.getData("text/plain") || draggingId;
                        if (sid && sid !== s.id)
                          await moveSession(sid, dayName, s.startsAt);
                        setDraggingId(null);
                      }}
                    />
                  ))}

                  {sessions.length === 0 && (
                    <div className="tt-col__empty">
                      {detail.isEditable && !past ? (
                        <button
                          type="button"
                          className="tt-col__hint"
                          onClick={() => openNewForDay(dayName)}
                          tabIndex={-1}
                        >
                          + Add session
                        </button>
                      ) : (
                        <span className="tt-col__no-session">No session on this day</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Day-level add button — hidden for past days */}
                {detail.isEditable && !past && (
                  <button
                    type="button"
                    className="tt-col__add"
                    onClick={() => openNewForDay(dayName)}
                    disabled={isBusy}
                    aria-label={`Add session on ${dayName}`}
                  >
                    +
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Session drawer overlay ────────────────────────────────────────── */}
      {drawerOpen && (
        <div
          className="tt-overlay"
          aria-hidden
          onClick={closeDrawer}
        />
      )}

      {/* ── Session drawer ────────────────────────────────────────────────── */}
      <aside
        className={`tt-drawer${drawerOpen ? " tt-drawer--open" : ""}`}
        aria-label="Session editor"
        aria-hidden={!drawerOpen}
      >
        <div className="tt-drawer__hd">
          <h2 className="tt-drawer__title">
            {selectedSessionId === "new"
              ? `New session — ${selectedDay}`
              : "Edit session"}
          </h2>
          <button
            type="button"
            className="tt-icon-btn"
            onClick={closeDrawer}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {form && (
          <div className="tt-drawer__bd">
            {/* Type selector */}
            <div className="tt-type-tabs">
              {(["training", "match"] as ScheduleSessionType[]).map(
                (t) => (
                  <button
                    key={t}
                    type="button"
                    className={`tt-type-tab${form.type === t ? " tt-type-tab--on" : ""}`}
                    style={
                      {
                        "--tab-c": SESSION_COLORS[t].badge
                      } as React.CSSProperties
                    }
                    onClick={() => setForm({ ...form, type: t })}
                  >
                    {sessionTypeLabel(t)}
                  </button>
                )
              )}
            </div>

            {/* ── Date ─────────────────────────────────────────────── */}
            <label className="tt-field">
              <span className="tt-label">Date</span>
              <input
                type="date"
                className="tt-input tt-date-input"
                value={datePart(form.startsAt)}
                min={format(
                  new Date(
                    Math.max(
                      parseISO(`${detail?.week.weekStart ?? "2000-01-01"}T00:00:00`).getTime(),
                      new Date().setHours(0, 0, 0, 0)
                    )
                  ),
                  "yyyy-MM-dd"
                )}
                max={format(
                  addDays(parseISO(`${detail?.week.weekStart ?? "2000-01-01"}T00:00:00`), 6),
                  "yyyy-MM-dd"
                )}
                onChange={(e) => {
                  const d = e.target.value;
                  setForm((f) => {
                    if (!f) return f;
                    return {
                      ...f,
                      startsAt: combineDateTime(d, timePart(f.startsAt)),
                      endsAt: combineDateTime(d, timePart(f.endsAt))
                    };
                  });
                }}
              />
            </label>

            {/* ── Start / End time ──────────────────────────────────── */}
            <div className="tt-row">
              <label className="tt-field">
                <span className="tt-label">Start time</span>
                <select
                  className="tt-input tt-time-select"
                  value={timePart(form.startsAt)}
                  onChange={(e) => {
                    const t = e.target.value;
                    const newPeriod = derivePeriod(t);
                    setForm((f) => {
                      if (!f) return f;
                      return {
                        ...f,
                        startsAt: combineDateTime(datePart(f.startsAt), t),
                        period: newPeriod
                      };
                    });
                  }}
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="tt-field">
                <span className="tt-label">End time</span>
                <select
                  className="tt-input tt-time-select"
                  value={timePart(form.endsAt)}
                  onChange={(e) => {
                    const t = e.target.value;
                    setForm((f) => {
                      if (!f) return f;
                      return {
                        ...f,
                        endsAt: combineDateTime(datePart(f.endsAt), t)
                      };
                    });
                  }}
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
            </div>

            {/* ── Auto-detected period (read-only) ───────────────────── */}
            {(() => {
              const pd = derivePeriodDisplay(timePart(form.startsAt));
              return (
                <div className={`tt-period-badge tt-period-badge--${pd.key}`}>
                  <span className="tt-period-badge__icon" aria-hidden>
                    {pd.key === "morning" ? "🌅" : pd.key === "afternoon" ? "☀️" : "🌙"}
                  </span>
                  <span className="tt-period-badge__label">{pd.label}</span>
                  <span className="tt-period-badge__lock" aria-label="Auto-detected, read-only">🔒 Auto-detected</span>
                </div>
              );
            })()}

            {/* ── Pitch ─────────────────────────────────────────────── */}
            <label className="tt-field">
              <span className="tt-label">Pitch / location</span>
              <select
                className="tt-input"
                value={form.pitchId}
                onChange={(e) =>
                  setForm({ ...form, pitchId: e.target.value })
                }
              >
                <option value="">— Select pitch —</option>
                {pitches
                  .filter((p) => p.active)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </label>

            {/* Match fields */}
            {form.type === "match" && (
              <>
                <div className="tt-row">
                  <label className="tt-field">
                    <span className="tt-label">Team A (home)</span>
                    <select
                      className="tt-input"
                      value={form.teamA}
                      onChange={(e) =>
                        setForm({ ...form, teamA: e.target.value })
                      }
                    >
                      {SCHEDULE_TEAMS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="tt-field">
                    <span className="tt-label">Team B (visiting)</span>
                    {/* Free-text with suggestions — admin can type any visiting team name */}
                    <input
                      type="text"
                      className="tt-input"
                      list="tt-teams-list"
                      value={form.teamB}
                      onChange={(e) =>
                        setForm({ ...form, teamB: e.target.value })
                      }
                      placeholder="e.g. Rival FC, Guest XI…"
                      autoComplete="off"
                    />
                    <datalist id="tt-teams-list">
                      {SCHEDULE_TEAMS.map((t) => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                  </label>
                </div>
                <label className="tt-field">
                  <span className="tt-label">Match notes</span>
                  <textarea
                    className="tt-input tt-textarea"
                    rows={2}
                    value={form.matchNotes}
                    onChange={(e) =>
                      setForm({ ...form, matchNotes: e.target.value })
                    }
                  />
                </label>
              </>
            )}

            {/* Training / rest fields */}
            {form.type !== "match" && (
              <>
                <fieldset className="tt-chips-set">
                  <legend className="tt-label">Age groups</legend>
                  <div className="tt-chips">
                    {AGE_GROUPS.map((g) => (
                      <button
                        key={g}
                        type="button"
                        className={`tt-chip${form.ageGroups.includes(g) ? " tt-chip--on" : ""}`}
                        onClick={() => toggleGroup(g)}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="tt-chips-set">
                  <legend className="tt-label">Coaches</legend>
                  <div className="tt-chips">
                    {coaches.length === 0 ? (
                      <span className="tt-chips-empty">No coaches available</span>
                    ) : (
                      coaches.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className={`tt-chip${form.coachIds.includes(c.id) ? " tt-chip--on" : ""}`}
                          onClick={() => toggleCoach(c.id, form.type === "training")}
                        >
                          {c.name}
                        </button>
                      ))
                    )}
                  </div>
                </fieldset>

                <label className="tt-field">
                  <span className="tt-label">
                    {form.type === "rest" ? "Rest title" : "Training topic"}
                  </span>
                  <input
                    className="tt-input"
                    value={form.trainingTopic}
                    onChange={(e) =>
                      setForm({ ...form, trainingTopic: e.target.value })
                    }
                  />
                </label>
                <label className="tt-field">
                  <span className="tt-label">Objectives</span>
                  <textarea
                    className="tt-input tt-textarea"
                    rows={2}
                    value={form.objectives}
                    onChange={(e) =>
                      setForm({ ...form, objectives: e.target.value })
                    }
                  />
                </label>
                <label className="tt-field">
                  <span className="tt-label">Kit / equipment</span>
                  <textarea
                    className="tt-input tt-textarea"
                    rows={2}
                    value={form.kit}
                    onChange={(e) => setForm({ ...form, kit: e.target.value })}
                  />
                </label>
              </>
            )}

            {/* Conflict warning */}
            {formConflicts.length > 0 && (
              <div className="tt-form-conflict">
                <span className="tt-form-conflict__icon">⚠</span>
                <div>
                  <strong>Conflict detected</strong>
                  <ul className="tt-form-conflict__list">
                    {formConflicts.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Drawer actions */}
            <div className="tt-drawer__ft">
              <button
                type="button"
                className="tt-btn"
                disabled={isBusy || formConflicts.length > 0}
                onClick={saveSession}
              >
                {saving ? (
                  <>
                    <TtSpinner />{" "}
                    {selectedSessionId === "new" ? "Adding…" : "Saving…"}
                  </>
                ) : selectedSessionId === "new" ? (
                  "Add session"
                ) : (
                  "Save changes"
                )}
              </button>

              {selectedSessionId && selectedSessionId !== "new" && (
                <button
                  type="button"
                  className="tt-btn tt-btn--danger"
                  disabled={isBusy}
                  onClick={() =>
                    typeof selectedSessionId === "string" &&
                    setConfirmDeleteId(selectedSessionId)
                  }
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        )}
      </aside>

      {/* ── Delete confirmation modal ─────────────────────────────────────── */}
      {/* ── Discard draft confirmation ───────────────────────────────────── */}
      {confirmDiscardDraft && (
        <div className="tt-modal-wrap" role="dialog" aria-modal aria-labelledby="tt-discard-title">
          <div className="tt-modal">
            <h2 id="tt-discard-title" className="tt-modal__title">
              Discard draft changes?
            </h2>
            <p className="tt-modal__body">
              This will permanently discard all unsaved draft sessions for this week. The previously published schedule will be restored. This action cannot be undone.
            </p>
            <div className="tt-modal__ft">
              <button
                type="button"
                className="tt-btn tt-btn--danger"
                disabled={isBusy}
                onClick={() => {
                  setConfirmDiscardDraft(false);
                  void discardDraft();
                }}
              >
                {saving ? <TtSpinner /> : null} Discard draft
              </button>
              <button
                type="button"
                className="tt-btn tt-btn--secondary"
                onClick={() => setConfirmDiscardDraft(false)}
              >
                Keep editing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete whole week confirmation ───────────────────────────────── */}
      {confirmDeleteWeek && summary && (
        <div className="tt-modal-wrap" role="dialog" aria-modal aria-labelledby="tt-delwk-title">
          <div className="tt-modal">
            <h2 id="tt-delwk-title" className="tt-modal__title">
              Delete entire week?
            </h2>
            <p className="tt-modal__body">
              This will permanently delete the week of{" "}
              <strong>{summary.weekRangeLabel}</strong> — including all sessions,
              drafts, and published data. This action cannot be undone.
            </p>
            <div className="tt-modal__ft">
              <button
                type="button"
                className="tt-btn tt-btn--danger"
                disabled={isBusy}
                onClick={() => {
                  setConfirmDeleteWeek(false);
                  void deleteWholeWeek();
                }}
              >
                {saving ? <TtSpinner /> : null} Delete week
              </button>
              <button
                type="button"
                className="tt-btn tt-btn--secondary"
                onClick={() => setConfirmDeleteWeek(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <div
          className="tt-modal-wrap"
          role="dialog"
          aria-modal
          aria-labelledby="tt-del-title"
        >
          <div className="tt-modal">
            <h2 id="tt-del-title" className="tt-modal__title">
              Delete this session?
            </h2>
            <p className="tt-modal__body">
              This will permanently remove the session from the draft. This
              action cannot be undone.
            </p>
            <div className="tt-modal__ft">
              <button
                type="button"
                className="tt-btn tt-btn--danger"
                disabled={isBusy}
                onClick={() => void deleteSession(confirmDeleteId)}
              >
                {saving ? <TtSpinner /> : null} Delete session
              </button>
              <button
                type="button"
                className="tt-btn tt-btn--secondary"
                onClick={() => setConfirmDeleteId(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── New week modal ────────────────────────────────────────────────── */}
      {showNewWeekModal && (
        <div
          className="tt-modal-wrap"
          role="dialog"
          aria-modal
          aria-labelledby="tt-wk-title"
        >
          <div className="tt-modal">
            <h2 id="tt-wk-title" className="tt-modal__title">
              Create new week
            </h2>
            <p className="tt-modal__body">
              Select the Monday that starts the week you want to schedule.
            </p>
            <label className="tt-field">
              <span className="tt-label">Week start (must be a Monday)</span>
              <input
                type="date"
                className="tt-input"
                value={newWeekStart}
                onChange={(e) => setNewWeekStart(e.target.value)}
              />
            </label>
            <div className="tt-modal__ft">
              <button
                type="button"
                className="tt-btn"
                disabled={!newWeekStart || saving}
                onClick={createWeek}
              >
                {saving ? <TtSpinner /> : null} Create week
              </button>
              <button
                type="button"
                className="tt-btn tt-btn--secondary"
                onClick={() => {
                  setShowNewWeekModal(false);
                  setNewWeekStart("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
