"use client";

import { useCallback, useEffect, useState } from "react";
import type { SiteContent } from "@/lib/types";
import {
  CmsEditorLoadFailed,
  CmsFormActions,
  CmsImageField,
  CmsLoadingState,
  CmsPageHeader,
  CmsSection
} from "../_components/cms-shared";
import { useAdminSiteContent } from "../_lib/use-admin-site-content";

export function EventsEditor() {
  const { data, loading, err, saving, savePartial, load } = useAdminSiteContent();
  const [eventsPageTitle, setEventsPageTitle] = useState("");
  const [eventsPageLead, setEventsPageLead] = useState("");
  const [events, setEvents] = useState<SiteContent["events"]>([]);

  const apply = useCallback((c: SiteContent) => {
    setEventsPageTitle(c.eventsPageTitle);
    setEventsPageLead(c.eventsPageLead);
    setEvents(c.events.map((e) => ({ ...e })));
  }, []);

  useEffect(() => {
    if (data) apply(data);
  }, [data, apply]);

  if (loading) return <CmsLoadingState message="Loading events editor…" />;

  if (!data) return <CmsEditorLoadFailed err={err} load={load} />;

  return (
    <section className="page-stack cms-editor-stack cms-editor-stack--cms">
      <CmsPageHeader
        title="Events"
        lead="Page header and event cards on /events — same order as the public page (hero copy, then each event)."
        previewHref="/events"
      />
      <CmsSection id="cms-events-page" title="Page & events" description="Title and lead at the top of /events, then each event card with schedule and optional image.">
        <label className="form-label">
          <span>Page title</span>
          <input className="input-field" value={eventsPageTitle} onChange={(e) => setEventsPageTitle(e.target.value)} />
        </label>
        <label className="form-label">
          <span>Page lead</span>
          <textarea className="input-field" rows={2} value={eventsPageLead} onChange={(e) => setEventsPageLead(e.target.value)} />
        </label>
        {events.map((ev) => (
          <div key={ev.id} className="card" style={{ marginBottom: "0.75rem", padding: "1rem" }}>
            <label className="form-label">
              <span>Title</span>
              <input
                className="input-field"
                value={ev.title}
                onChange={(e) => setEvents((prev) => prev.map((x) => (x.id === ev.id ? { ...x, title: e.target.value } : x)))}
              />
            </label>
            <label className="form-label">
              <span>Summary</span>
              <textarea
                className="input-field"
                rows={2}
                value={ev.summary}
                onChange={(e) => setEvents((prev) => prev.map((x) => (x.id === ev.id ? { ...x, summary: e.target.value } : x)))}
              />
            </label>
            <label className="form-label">
              <span>Starts at (ISO date/time)</span>
              <input
                className="input-field"
                value={ev.startsAt}
                onChange={(e) => setEvents((prev) => prev.map((x) => (x.id === ev.id ? { ...x, startsAt: e.target.value } : x)))}
              />
            </label>
            <label className="form-label">
              <span>Ends at (optional)</span>
              <input
                className="input-field"
                value={ev.endsAt ?? ""}
                onChange={(e) =>
                  setEvents((prev) => prev.map((x) => (x.id === ev.id ? { ...x, endsAt: e.target.value || undefined } : x)))
                }
              />
            </label>
            <label className="form-label">
              <span>Location</span>
              <input
                className="input-field"
                value={ev.location ?? ""}
                onChange={(e) =>
                  setEvents((prev) => prev.map((x) => (x.id === ev.id ? { ...x, location: e.target.value || undefined } : x)))
                }
              />
            </label>
            <CmsImageField
              label="Image (optional)"
              value={ev.image ?? ""}
              onChange={(url) => setEvents((prev) => prev.map((x) => (x.id === ev.id ? { ...x, image: url || undefined } : x)))}
              usage="card"
            />
            <button type="button" className="btn btn-secondary admin-btn-sm" onClick={() => setEvents((prev) => prev.filter((x) => x.id !== ev.id))}>
              Delete event
            </button>
          </div>
        ))}
        <CmsFormActions
          primaryLabel="Save events page"
          onPrimary={() => void savePartial({ eventsPageTitle, eventsPageLead, events })}
          saving={saving}
          secondary={
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                setEvents((prev) => [
                  ...prev,
                  {
                    id: `ev-${Date.now()}`,
                    title: "New event",
                    summary: "Description",
                    startsAt: new Date().toISOString()
                  }
                ])
              }
            >
              Add event
            </button>
          }
        />
      </CmsSection>
    </section>
  );
}
