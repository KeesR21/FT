"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SiteContent } from "@/lib/types";
import { CmsAlert, CmsEditorLoadFailed, CmsImageField, CmsLoadingState, CmsPageHeader } from "../_components/cms-shared";
import { useAdminSiteContent } from "../_lib/use-admin-site-content";

export function ScheduleEditor() {
  const { data, loading, err, saving, savePartial, load } = useAdminSiteContent();
  const [schedulePagePill, setSchedulePagePill] = useState("");
  const [scheduleHeroImage, setScheduleHeroImage] = useState("");
  const [schedulePageTitle, setSchedulePageTitle] = useState("");
  const [schedulePageLead, setSchedulePageLead] = useState("");
  const [scheduleTimelineTitle, setScheduleTimelineTitle] = useState("");
  const [scheduleTimelineLead, setScheduleTimelineLead] = useState("");
  const [scheduleLocationTitle, setScheduleLocationTitle] = useState("");
  const [scheduleLocationLead, setScheduleLocationLead] = useState("");
  const [scheduleLocationImage, setScheduleLocationImage] = useState("");
  const [scheduleParentBlurb, setScheduleParentBlurb] = useState("");

  const apply = useCallback((c: SiteContent) => {
    setSchedulePagePill(c.schedulePagePill);
    setScheduleHeroImage(c.scheduleHeroImage ?? "");
    setSchedulePageTitle(c.schedulePageTitle);
    setSchedulePageLead(c.schedulePageLead);
    setScheduleTimelineTitle(c.scheduleTimelineTitle);
    setScheduleTimelineLead(c.scheduleTimelineLead);
    setScheduleLocationTitle(c.scheduleLocationTitle);
    setScheduleLocationLead(c.scheduleLocationLead);
    setScheduleLocationImage(c.scheduleLocationImage ?? "");
    setScheduleParentBlurb(c.scheduleParentBlurb);
  }, []);

  useEffect(() => {
    if (data) apply(data);
  }, [data, apply]);

  const validationIssues = useMemo(() => {
    const issues: string[] = [];
    if (!schedulePagePill.trim()) issues.push("Hero pill label is required.");
    if (!schedulePageTitle.trim()) issues.push("Page title is required.");
    if (!schedulePageLead.trim()) issues.push("Page lead is required.");
    if (!scheduleTimelineTitle.trim()) issues.push("Timeline title is required.");
    if (scheduleTimelineLead.trim().length < 8) issues.push("Timeline lead should be at least 8 characters.");
    if (!scheduleLocationTitle.trim()) issues.push("Location title is required.");
    if (scheduleLocationLead.trim().length < 8) issues.push("Location lead should be at least 8 characters.");
    if (!scheduleLocationImage.trim()) issues.push("Location image is required.");
    if (scheduleParentBlurb.trim().length < 8) issues.push("Parent notifications blurb should be at least 8 characters.");
    return issues;
  }, [
    schedulePagePill,
    schedulePageTitle,
    schedulePageLead,
    scheduleTimelineTitle,
    scheduleTimelineLead,
    scheduleLocationTitle,
    scheduleLocationLead,
    scheduleLocationImage,
    scheduleParentBlurb
  ]);

  const payload = useMemo(
    () => ({
      schedulePagePill,
      scheduleHeroImage: scheduleHeroImage.trim() || undefined,
      schedulePageTitle,
      schedulePageLead,
      scheduleTimelineTitle,
      scheduleTimelineLead,
      scheduleLocationTitle,
      scheduleLocationLead,
      scheduleLocationImage,
      scheduleParentBlurb
    }),
    [
      schedulePagePill,
      scheduleHeroImage,
      schedulePageTitle,
      schedulePageLead,
      scheduleTimelineTitle,
      scheduleTimelineLead,
      scheduleLocationTitle,
      scheduleLocationLead,
      scheduleLocationImage,
      scheduleParentBlurb
    ]
  );

  if (loading) return <CmsLoadingState message="Loading schedule editor…" />;

  if (!data) return <CmsEditorLoadFailed err={err} load={load} />;

  return (
    <section className="page-stack cms-editor-stack cms-editor-stack--cms">
      <CmsPageHeader
        title="Schedule"
        lead="Sections follow /schedule (and fixtures): hero, timeline, location block with image, parent notifications. Save buttons are on each card."
        previewHref="/schedule"
      />
      {err ? (
        <CmsAlert variant="error" title="Could not save">
          {err}
        </CmsAlert>
      ) : null}
      {validationIssues.length > 0 ? (
        <CmsAlert variant="warning" title="Fix before saving">
          <ul>
            {validationIssues.map((issue, idx) => (
              <li key={`${idx}-${issue}`}>{issue}</li>
            ))}
          </ul>
        </CmsAlert>
      ) : null}

      <div className="card">
        <h2>Hero</h2>
        <p className="muted admin-cell-muted">Top section on /schedule and /fixtures.</p>
        <div className="form-grid-responsive admin-form-grid--2">
          <label className="form-label">
            <span>Hero pill label</span>
            <input className="input-field" value={schedulePagePill} onChange={(e) => setSchedulePagePill(e.target.value)} />
          </label>
          <label className="form-label">
            <span>Page title</span>
            <input className="input-field" value={schedulePageTitle} onChange={(e) => setSchedulePageTitle(e.target.value)} />
          </label>
        </div>
        <label className="form-label">
          <span>Page lead</span>
          <textarea className="input-field" rows={3} value={schedulePageLead} onChange={(e) => setSchedulePageLead(e.target.value)} />
        </label>
        <CmsImageField
          label="Hero background image"
          value={scheduleHeroImage}
          onChange={setScheduleHeroImage}
          usage="banner"
          help="Optional. Falls back to default schedule image if empty."
        />
        <div style={{ marginTop: "1rem" }}>
          <button type="button" className="btn" disabled={saving || validationIssues.length > 0} onClick={() => void savePartial(payload)}>
            {saving ? "Saving…" : "Save hero"}
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Timeline heading</h2>
        <p className="muted admin-cell-muted">Heading above session cards (sessions still managed in Timetable admin).</p>
        <label className="form-label">
          <span>Timeline title</span>
          <input className="input-field" value={scheduleTimelineTitle} onChange={(e) => setScheduleTimelineTitle(e.target.value)} />
        </label>
        <label className="form-label">
          <span>Timeline lead</span>
          <textarea className="input-field" rows={2} value={scheduleTimelineLead} onChange={(e) => setScheduleTimelineLead(e.target.value)} />
        </label>
        <div style={{ marginTop: "1rem" }}>
          <button type="button" className="btn" disabled={saving || validationIssues.length > 0} onClick={() => void savePartial(payload)}>
            {saving ? "Saving…" : "Save timeline heading"}
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Pitch location block</h2>
        <p className="muted admin-cell-muted">Image section with pitch-style background overlay under the timeline.</p>
        <label className="form-label">
          <span>Location title</span>
          <input className="input-field" value={scheduleLocationTitle} onChange={(e) => setScheduleLocationTitle(e.target.value)} />
        </label>
        <label className="form-label">
          <span>Location lead</span>
          <textarea className="input-field" rows={3} value={scheduleLocationLead} onChange={(e) => setScheduleLocationLead(e.target.value)} />
        </label>
        <CmsImageField
          label="Pitch background image"
          value={scheduleLocationImage}
          onChange={setScheduleLocationImage}
          usage="banner"
        />
        <div style={{ marginTop: "1rem" }}>
          <button type="button" className="btn" disabled={saving || validationIssues.length > 0} onClick={() => void savePartial(payload)}>
            {saving ? "Saving…" : "Save location block"}
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Parent notifications</h2>
        <label className="form-label">
          <span>Notifications blurb</span>
          <textarea className="input-field" rows={3} value={scheduleParentBlurb} onChange={(e) => setScheduleParentBlurb(e.target.value)} />
        </label>
        <div style={{ marginTop: "1rem" }}>
          <button type="button" className="btn" disabled={saving || validationIssues.length > 0} onClick={() => void savePartial(payload)}>
            {saving ? "Saving…" : "Save parent notifications"}
          </button>
        </div>
      </div>
    </section>
  );
}
