"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import type { CmsEventItem, SiteContent } from "@/lib/types";
import {
  CmsConfirmDialog,
  CmsDraftSwitch,
  CmsEditorLoadFailed,
  CmsLoadingState,
  CmsPageHeader,
  CmsSaveBar,
  CmsSection,
  CmsStatusBadge,
  CmsSubcard,
  CmsImageField
} from "../_components/cms-shared";
import { useAdminSiteContent } from "../_lib/use-admin-site-content";

/* ─── helpers ─────────────────────────────────────────────────── */

/** ISO → "YYYY-MM-DD" for <input type="date"> */
function isoToDateInput(iso: string): string {
  try {
    const d = parseISO(iso);
    return isValid(d) ? format(d, "yyyy-MM-dd") : "";
  } catch { return ""; }
}

/** ISO → "HH:mm" for <select> */
function isoToTimeInput(iso: string): string {
  try {
    const d = parseISO(iso);
    return isValid(d) ? format(d, "HH:mm") : "09:00";
  } catch { return "09:00"; }
}

/** date "YYYY-MM-DD" + time "HH:mm" → ISO string (local-time interpretation) */
function dateTimeToIso(date: string, time: string): string {
  if (!date) return new Date().toISOString();
  try {
    const [h, m] = (time || "09:00").split(":").map(Number);
    const d = new Date(date);
    d.setHours(h ?? 9, m ?? 0, 0, 0);
    return d.toISOString();
  } catch { return new Date().toISOString(); }
}

function generateTimeOptions(): { value: string; label: string }[] {
  const opts = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 15, 30, 45]) {
      const hh = h.toString().padStart(2, "0");
      const mm = m.toString().padStart(2, "0");
      const value = `${hh}:${mm}`;
      const period = h < 12 ? "AM" : "PM";
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const label = `${h12}:${mm} ${period}`;
      opts.push({ value, label });
    }
  }
  return opts;
}

const TIME_OPTIONS = generateTimeOptions();

/** Derive a display status for an event (may be scheduled for future) */
function eventDisplayStatus(ev: CmsEventItem): "draft" | "published" | "scheduled" | "expired" {
  if ((ev.status ?? "published") === "draft") return "draft";
  try {
    const starts = parseISO(ev.startsAt);
    const ends = ev.endsAt ? parseISO(ev.endsAt) : null;
    const now = new Date();
    if (ends && isValid(ends) && ends < now) return "expired";
    if (isValid(starts) && starts > now) return "scheduled";
  } catch { /* ignore */ }
  return "published";
}

/* ─── field-level validation ──────────────────────────────────── */

type EventErrors = { title?: string; startsAt?: string; summary?: string };

function validateEvent(ev: CmsEventItem, dateStr: string): EventErrors {
  const errs: EventErrors = {};
  if (!ev.title.trim()) errs.title = "Title is required.";
  if (!ev.summary.trim()) errs.summary = "Summary is required.";
  if (!dateStr) errs.startsAt = "Start date is required.";
  return errs;
}

/* ─── per-event local form state ──────────────────────────────── */

type LocalEvent = CmsEventItem & { _dateStr: string; _startTime: string; _endDateStr: string; _endTime: string };

function toLocal(ev: CmsEventItem): LocalEvent {
  return {
    ...ev,
    _dateStr: isoToDateInput(ev.startsAt),
    _startTime: isoToTimeInput(ev.startsAt),
    _endDateStr: ev.endsAt ? isoToDateInput(ev.endsAt) : "",
    _endTime: ev.endsAt ? isoToTimeInput(ev.endsAt) : "18:00"
  };
}

function fromLocal(lev: LocalEvent): CmsEventItem {
  const { _dateStr, _startTime, _endDateStr, _endTime, ...rest } = lev;
  const startsAt = dateTimeToIso(_dateStr, _startTime);
  const endsAt = _endDateStr ? dateTimeToIso(_endDateStr, _endTime) : undefined;
  return { ...rest, startsAt, endsAt };
}

/* ─── component ───────────────────────────────────────────────── */

export function EventsEditor() {
  const { data, loading, err, saving, saveWithNotify, load } = useAdminSiteContent();

  const [eventsPageTitle, setEventsPageTitle] = useState("");
  const [eventsPageLead, setEventsPageLead] = useState("");
  const [events, setEvents] = useState<LocalEvent[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, EventErrors>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const apply = useCallback((c: SiteContent) => {
    setEventsPageTitle(c.eventsPageTitle);
    setEventsPageLead(c.eventsPageLead);
    setEvents(c.events.map(toLocal));
  }, []);

  useEffect(() => {
    if (data) apply(data);
  }, [data, apply]);

  function updateEvent(id: string, patch: Partial<LocalEvent>) {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    if (patch.title || patch.summary || patch._dateStr) {
      setFieldErrors((prev) => ({ ...prev, [id]: {} }));
    }
  }

  function validateAll(): boolean {
    const allErrors: Record<string, EventErrors> = {};
    let valid = true;
    for (const ev of events) {
      const errs = validateEvent(ev, ev._dateStr);
      allErrors[ev.id] = errs;
      if (Object.keys(errs).length > 0) {
        valid = false;
        if (!expandedId) setExpandedId(ev.id);
      }
    }
    setFieldErrors(allErrors);
    return valid;
  }

  async function handleSave() {
    if (!validateAll()) return;
    await saveWithNotify(
      { eventsPageTitle, eventsPageLead, events: events.map(fromLocal) },
      "Events saved successfully."
    );
  }

  function confirmDelete(id: string) {
    setConfirmDeleteId(id);
  }

  function executeDelete() {
    if (!confirmDeleteId) return;
    setEvents((prev) => prev.filter((e) => e.id !== confirmDeleteId));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[confirmDeleteId];
      return next;
    });
    setConfirmDeleteId(null);
  }

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => a._dateStr.localeCompare(b._dateStr)),
    [events]
  );

  const upcomingCount = useMemo(
    () => events.filter((e) => (e.status ?? "published") !== "draft" && e._dateStr >= new Date().toISOString().slice(0, 10)).length,
    [events]
  );

  if (loading) return <CmsLoadingState message="Loading events editor…" />;
  if (!data) return <CmsEditorLoadFailed err={err} load={load} />;

  const confirmTarget = confirmDeleteId ? events.find((e) => e.id === confirmDeleteId) : null;

  return (
    <>
      <CmsConfirmDialog
        open={!!confirmDeleteId}
        title="Delete event?"
        message={confirmTarget ? <>Remove <strong>{confirmTarget.title || "this event"}</strong>? This cannot be undone.</> : "Remove this event?"}
        confirmLabel="Delete event"
        onConfirm={executeDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />

      <section className="page-stack cms-editor-stack cms-editor-stack--cms">
        <CmsPageHeader
          title="Events"
          lead="Page header and event cards on /events — published events appear to visitors; drafts are hidden."
          previewHref="/events"
        />

        {/* Page copy */}
        <CmsSection id="cms-events-page-copy" title="Page header" description="Title and intro lead shown at the top of /events.">
          <label className="form-label">
            <span>Page title</span>
            <input className="input-field" value={eventsPageTitle} onChange={(e) => setEventsPageTitle(e.target.value)} />
          </label>
          <label className="form-label">
            <span>Page lead</span>
            <textarea className="input-field" rows={2} value={eventsPageLead} onChange={(e) => setEventsPageLead(e.target.value)} />
          </label>
        </CmsSection>

        {/* Events list */}
        <CmsSection
          id="cms-events-list"
          title={`Events (${events.length})`}
          description={`${upcomingCount} upcoming published event${upcomingCount !== 1 ? "s" : ""} visible on the public site.`}
        >
          {events.length === 0 ? (
            <p className="muted cms-events-empty">No events yet. Add one below.</p>
          ) : (
            <div className="cms-events-list">
              {sortedEvents.map((ev) => {
                const displayStatus = eventDisplayStatus(ev);
                const errs = fieldErrors[ev.id] ?? {};
                const isExpanded = expandedId === ev.id;
                return (
                  <CmsSubcard key={ev.id} label={undefined}>
                    {/* Header row */}
                    <div className="cms-event-card__header">
                      <button
                        type="button"
                        className="cms-event-card__toggle"
                        onClick={() => setExpandedId(isExpanded ? null : ev.id)}
                        aria-expanded={isExpanded}
                      >
                        <span className="cms-event-card__toggle-icon" aria-hidden>{isExpanded ? "▲" : "▼"}</span>
                        <div className="cms-event-card__header-info">
                          <span className="cms-event-card__title-preview">
                            {ev.title || <em className="muted">Untitled event</em>}
                          </span>
                          <span className="cms-event-card__date-preview muted">
                            {ev._dateStr
                              ? (() => { try { return format(parseISO(ev._dateStr), "EEE d MMM yyyy"); } catch { return ev._dateStr; } })()
                              : "No date set"}
                          </span>
                        </div>
                        <CmsStatusBadge status={displayStatus} />
                      </button>
                      <button
                        type="button"
                        className="cms-event-card__delete-btn"
                        onClick={() => confirmDelete(ev.id)}
                        title="Delete this event"
                        aria-label={`Delete ${ev.title || "this event"}`}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        </svg>
                      </button>
                    </div>

                    {/* Expandable form */}
                    {isExpanded && (
                      <div className="cms-event-card__body">
                        {/* Draft/Published toggle */}
                        <div className="cms-event-card__status-row">
                          <CmsDraftSwitch
                            value={ev.status ?? "published"}
                            onChange={(v) => updateEvent(ev.id, { status: v })}
                          />
                        </div>

                        {/* Title */}
                        <div className="cms-event-card__field">
                          <label className="form-label" htmlFor={`ev-title-${ev.id}`}>
                            <span>Event title <span className="cms-event-card__required">*</span></span>
                          </label>
                          <input
                            id={`ev-title-${ev.id}`}
                            className={`input-field${errs.title ? " input-field--error" : ""}`}
                            value={ev.title}
                            onChange={(e) => updateEvent(ev.id, { title: e.target.value })}
                          />
                          {errs.title && <span className="cms-field-error">{errs.title}</span>}
                        </div>

                        {/* Summary */}
                        <div className="cms-event-card__field">
                          <label className="form-label" htmlFor={`ev-summary-${ev.id}`}>
                            <span>Summary <span className="cms-event-card__required">*</span></span>
                          </label>
                          <textarea
                            id={`ev-summary-${ev.id}`}
                            className={`input-field${errs.summary ? " input-field--error" : ""}`}
                            rows={2}
                            value={ev.summary}
                            onChange={(e) => updateEvent(ev.id, { summary: e.target.value })}
                          />
                          {errs.summary && <span className="cms-field-error">{errs.summary}</span>}
                        </div>

                        {/* Start date + time */}
                        <div className="cms-event-card__datetime-row">
                          <div className="cms-event-card__field cms-event-card__field--date">
                            <label className="form-label" htmlFor={`ev-startdate-${ev.id}`}>
                              <span>Start date <span className="cms-event-card__required">*</span></span>
                            </label>
                            <input
                              id={`ev-startdate-${ev.id}`}
                              type="date"
                              className={`input-field tt-date-input${errs.startsAt ? " input-field--error" : ""}`}
                              value={ev._dateStr}
                              onChange={(e) => updateEvent(ev.id, { _dateStr: e.target.value })}
                            />
                            {errs.startsAt && <span className="cms-field-error">{errs.startsAt}</span>}
                          </div>
                          <div className="cms-event-card__field cms-event-card__field--time">
                            <label className="form-label" htmlFor={`ev-starttime-${ev.id}`}>
                              <span>Start time</span>
                            </label>
                            <select
                              id={`ev-starttime-${ev.id}`}
                              className="input-field tt-time-select"
                              value={ev._startTime}
                              onChange={(e) => updateEvent(ev.id, { _startTime: e.target.value })}
                            >
                              {TIME_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* End date + time */}
                        <div className="cms-event-card__datetime-row">
                          <div className="cms-event-card__field cms-event-card__field--date">
                            <label className="form-label" htmlFor={`ev-enddate-${ev.id}`}>
                              <span>End date <span className="cms-event-card__label-hint">(optional)</span></span>
                            </label>
                            <input
                              id={`ev-enddate-${ev.id}`}
                              type="date"
                              className="input-field tt-date-input"
                              value={ev._endDateStr}
                              min={ev._dateStr}
                              onChange={(e) => updateEvent(ev.id, { _endDateStr: e.target.value })}
                            />
                          </div>
                          {ev._endDateStr && (
                            <div className="cms-event-card__field cms-event-card__field--time">
                              <label className="form-label" htmlFor={`ev-endtime-${ev.id}`}>
                                <span>End time</span>
                              </label>
                              <select
                                id={`ev-endtime-${ev.id}`}
                                className="input-field tt-time-select"
                                value={ev._endTime}
                                onChange={(e) => updateEvent(ev.id, { _endTime: e.target.value })}
                              >
                                {TIME_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>

                        {/* Location */}
                        <div className="cms-event-card__field">
                          <label className="form-label" htmlFor={`ev-location-${ev.id}`}>
                            <span>Location <span className="cms-event-card__label-hint">(optional)</span></span>
                          </label>
                          <input
                            id={`ev-location-${ev.id}`}
                            className="input-field"
                            value={ev.location ?? ""}
                            placeholder="e.g. FTPR Main Pitch, Kigali"
                            onChange={(e) => updateEvent(ev.id, { location: e.target.value || undefined })}
                          />
                        </div>

                        {/* Image */}
                        <CmsImageField
                          label="Event image (optional)"
                          value={ev.image ?? ""}
                          onChange={(url) => updateEvent(ev.id, { image: url || undefined })}
                          usage="card"
                        />
                      </div>
                    )}
                  </CmsSubcard>
                );
              })}
            </div>
          )}

          <div className="cms-events-add-row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                const id = `ev-${Date.now()}`;
                const newEv = toLocal({
                  id,
                  title: "",
                  summary: "",
                  startsAt: new Date().toISOString(),
                  status: "draft"
                });
                setEvents((prev) => [...prev, newEv]);
                setExpandedId(id);
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add event
            </button>
          </div>

          <CmsSaveBar
            saving={saving}
            error={err || undefined}
            onSave={handleSave}
            saveLabel="Save all events"
            successMsg="Events saved successfully."
          />
        </CmsSection>
      </section>
    </>
  );
}
