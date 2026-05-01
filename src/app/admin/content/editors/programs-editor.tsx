"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SiteContent } from "@/lib/types";
import { CmsAlert, CmsEditorLoadFailed, CmsImageField, CmsLoadingState, CmsPageHeader } from "../_components/cms-shared";
import { useAdminSiteContent } from "../_lib/use-admin-site-content";

export function ProgramsEditor() {
  const { data, loading, err, saving, savePartial, load } = useAdminSiteContent();
  const [programsPagePill, setProgramsPagePill] = useState("");
  const [programsHeroImage, setProgramsHeroImage] = useState("");
  const [programsPageTitle, setProgramsPageTitle] = useState("");
  const [programsPageLead, setProgramsPageLead] = useState("");
  const [programsSpotlightTitle, setProgramsSpotlightTitle] = useState("");
  const [programsSpotlightLead, setProgramsSpotlightLead] = useState("");
  const [programsSpotlightItems, setProgramsSpotlightItems] = useState<SiteContent["programsSpotlightItems"]>([]);
  const [programsPathwayTitle, setProgramsPathwayTitle] = useState("");
  const [programsPathwayBlurb, setProgramsPathwayBlurb] = useState("");
  const [programsPathwayLineTitle, setProgramsPathwayLineTitle] = useState("");
  const [programsPathwayLineLead, setProgramsPathwayLineLead] = useState("");
  const [programsPathwayLineScrollLabel, setProgramsPathwayLineScrollLabel] = useState("");
  const [programsPathwayLineItems, setProgramsPathwayLineItems] = useState<SiteContent["programsPathwayLineItems"]>([]);
  const [groups, setGroups] = useState<SiteContent["programGroups"]>([]);
  const [programsSideImage, setProgramsSideImage] = useState("");
  const [programsSplitTitle, setProgramsSplitTitle] = useState("");
  const [programsSplitLead, setProgramsSplitLead] = useState("");
  const [programsCtaTitle, setProgramsCtaTitle] = useState("");
  const [programsCtaLead, setProgramsCtaLead] = useState("");

  const apply = useCallback((c: SiteContent) => {
    setProgramsPagePill(c.programsPagePill);
    setProgramsHeroImage(c.programsHeroImage ?? "");
    setProgramsPageTitle(c.programsPageTitle);
    setProgramsPageLead(c.programsPageLead);
    setProgramsSpotlightTitle(c.programsSpotlightTitle);
    setProgramsSpotlightLead(c.programsSpotlightLead);
    setProgramsSpotlightItems((c.programsSpotlightItems ?? []).map((x) => ({ ...x })));
    setProgramsPathwayTitle(c.programsPathwayTitle);
    setProgramsPathwayBlurb(c.programsPathwayBlurb);
    setProgramsPathwayLineTitle(c.programsPathwayLineTitle);
    setProgramsPathwayLineLead(c.programsPathwayLineLead);
    setProgramsPathwayLineScrollLabel(c.programsPathwayLineScrollLabel ?? "");
    setProgramsPathwayLineItems((c.programsPathwayLineItems ?? []).map((x) => ({ ...x })));
    setGroups(c.programGroups.map((g) => ({ ...g })));
    setProgramsSideImage(c.programsSideImage);
    setProgramsSplitTitle(c.programsSplitTitle);
    setProgramsSplitLead(c.programsSplitLead);
    setProgramsCtaTitle(c.programsCtaTitle);
    setProgramsCtaLead(c.programsCtaLead);
  }, []);

  useEffect(() => {
    if (data) apply(data);
  }, [data, apply]);

  const validationIssues = useMemo(() => {
    const issues: string[] = [];
    if (!programsPagePill.trim()) issues.push("Hero pill is required.");
    if (!programsPageTitle.trim()) issues.push("Page title is required.");
    if (!programsPageLead.trim()) issues.push("Hero lead is required.");
    if (programsSpotlightItems.length > 0) {
      if (!programsSpotlightTitle.trim()) issues.push("Spotlight section title is required when images are present.");
      if (!programsSpotlightLead.trim()) issues.push("Spotlight lead is required when images are present.");
      programsSpotlightItems.forEach((s, idx) => {
        const n = idx + 1;
        if (!s.src.trim()) issues.push(`Spotlight ${n}: image path required.`);
        if (s.caption.trim().length < 2) issues.push(`Spotlight ${n}: caption needs at least 2 characters.`);
      });
    }
    if (!programsPathwayTitle.trim()) issues.push("Pathway title is required.");
    if (programsPathwayBlurb.trim().length < 12) issues.push("Pathway intro should be at least 12 characters.");
    if (programsPathwayLineItems.length >= 2) {
      if (!programsPathwayLineTitle.trim()) issues.push("Animated pathway title is required when 2+ steps are set.");
      if (programsPathwayLineLead.trim().length < 8) issues.push("Animated pathway lead should be at least 8 characters.");
      if (programsPathwayLineScrollLabel.trim().length < 2) {
        issues.push("Scroller hint (small caps under the line) needs at least 2 characters when the pathway is visible.");
      }
      programsPathwayLineItems.forEach((s, idx) => {
        const n = idx + 1;
        if (!s.name.trim()) issues.push(`Pathway step ${n}: label (e.g. U9) is required.`);
        if (s.description.trim().length < 4) issues.push(`Pathway step ${n}: description is too short.`);
      });
    }
    if (groups.length === 0) issues.push("Add at least one age group.");
    groups.forEach((g, idx) => {
      const n = idx + 1;
      if (!g.name.trim()) issues.push(`Age group ${n}: name is required.`);
      if (g.description.trim().length < 4) issues.push(`Age group ${n}: description is too short.`);
    });
    if (!programsSideImage.trim()) issues.push("Split section image is required.");
    if (!programsSplitTitle.trim()) issues.push("Split title is required.");
    if (!programsSplitLead.trim()) issues.push("Split lead is required.");
    if (!programsCtaTitle.trim()) issues.push("Bottom CTA title is required.");
    if (!programsCtaLead.trim()) issues.push("Bottom CTA lead is required.");
    return issues;
  }, [
    programsPagePill,
    programsPageTitle,
    programsPageLead,
    programsSpotlightTitle,
    programsSpotlightLead,
    programsSpotlightItems,
    programsPathwayTitle,
    programsPathwayBlurb,
    programsPathwayLineTitle,
    programsPathwayLineLead,
    programsPathwayLineScrollLabel,
    programsPathwayLineItems,
    groups,
    programsSideImage,
    programsSplitTitle,
    programsSplitLead,
    programsCtaTitle,
    programsCtaLead
  ]);

  const payload = useMemo(
    () => ({
      programsPagePill,
      programsHeroImage: programsHeroImage.trim() || undefined,
      programsPageTitle,
      programsPageLead,
      programsSpotlightTitle,
      programsSpotlightLead,
      programsSpotlightItems,
      programsPathwayTitle,
      programsPathwayBlurb,
      programsPathwayLineTitle,
      programsPathwayLineLead,
      programsPathwayLineScrollLabel,
      programsPathwayLineItems,
      programGroups: groups,
      programsSideImage,
      programsSplitTitle,
      programsSplitLead,
      programsCtaTitle,
      programsCtaLead
    }),
    [
      programsPagePill,
      programsHeroImage,
      programsPageTitle,
      programsPageLead,
      programsSpotlightTitle,
      programsSpotlightLead,
      programsSpotlightItems,
      programsPathwayTitle,
      programsPathwayBlurb,
      programsPathwayLineTitle,
      programsPathwayLineLead,
      programsPathwayLineScrollLabel,
      programsPathwayLineItems,
      groups,
      programsSideImage,
      programsSplitTitle,
      programsSplitLead,
      programsCtaTitle,
      programsCtaLead
    ]
  );

  async function savePrograms() {
    if (validationIssues.length > 0) return;
    await savePartial(payload);
  }

  function updateGroup(id: string, field: "name" | "description" | "image", v: string) {
    setGroups((prev) => prev.map((x) => (x.id === id ? { ...x, [field]: v } : x)));
  }

  function addGroup() {
    setGroups((g) => [
      ...g,
      {
        id: `pg-${Date.now()}`,
        name: "U12",
        description: "Description for this age group.",
        image: "/academy-1.png"
      }
    ]);
  }

  function removeGroup(id: string) {
    setGroups((prev) => prev.filter((x) => x.id !== id));
  }

  function updateSpotlight(id: string, field: "src" | "caption", v: string) {
    setProgramsSpotlightItems((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: v } : s)));
  }

  function addSpotlight() {
    setProgramsSpotlightItems((prev) => [
      ...prev,
      { id: `ps-${Date.now()}`, src: "/gallery/FTPR_49.JPG", caption: "Caption" }
    ]);
  }

  function removeSpotlight(id: string) {
    setProgramsSpotlightItems((prev) => prev.filter((s) => s.id !== id));
  }

  function movePathwayLineStep(id: string, delta: number) {
    setProgramsPathwayLineItems((prev) => {
      const i = prev.findIndex((x) => x.id === id);
      if (i < 0) return prev;
      const j = i + delta;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  if (loading) return <CmsLoadingState message="Loading programs editor…" />;

  if (!data) return <CmsEditorLoadFailed err={err} load={load} />;

  return (
    <section className="page-stack cms-editor-stack cms-editor-stack--cms">
      <CmsPageHeader
        title="Programs"
        lead="Sections follow /programs top-to-bottom: hero, spotlight, pathway band, age groups, split, CTA. Each card block can be saved with the buttons inside it (same validation as Home)."
        previewHref="/programs"
      />
      {err ? (
        <CmsAlert variant="error" title="Could not save">
          {err}
        </CmsAlert>
      ) : null}
      {validationIssues.length > 0 ? (
        <CmsAlert variant="warning" title="Fix before saving">
          <ul>
            {validationIssues.map((i, idx) => (
              <li key={`${idx}-${i}`}>{i}</li>
            ))}
          </ul>
        </CmsAlert>
      ) : null}

      <div className="card">
        <h2>Hero</h2>
        <p className="muted admin-cell-muted">Full-bleed top of /programs and /teams.</p>
        <div className="form-grid-responsive admin-form-grid--2">
          <label className="form-label">
            <span>Pill label</span>
            <input className="input-field" value={programsPagePill} onChange={(e) => setProgramsPagePill(e.target.value)} />
          </label>
          <label className="form-label">
            <span>Page title (H1)</span>
            <input className="input-field" value={programsPageTitle} onChange={(e) => setProgramsPageTitle(e.target.value)} />
          </label>
        </div>
        <label className="form-label">
          <span>Hero lead</span>
          <textarea className="input-field" rows={3} value={programsPageLead} onChange={(e) => setProgramsPageLead(e.target.value)} />
        </label>
        <CmsImageField
          label="Hero background"
          value={programsHeroImage}
          onChange={setProgramsHeroImage}
          usage="banner"
          help="Optional — a default image is used if empty."
        />
        <div style={{ marginTop: "1rem" }}>
          <button type="button" className="btn" disabled={saving || validationIssues.length > 0} onClick={() => void savePrograms()}>
            {saving ? "Saving…" : "Save hero"}
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Spotlight row</h2>
        <p className="muted admin-cell-muted">Three image cards with captions (animated strip on the public page).</p>
        <label className="form-label">
          <span>Section title</span>
          <input className="input-field" value={programsSpotlightTitle} onChange={(e) => setProgramsSpotlightTitle(e.target.value)} />
        </label>
        <label className="form-label">
          <span>Section lead</span>
          <textarea className="input-field" rows={2} value={programsSpotlightLead} onChange={(e) => setProgramsSpotlightLead(e.target.value)} />
        </label>
        {programsSpotlightItems.map((s, index) => (
          <div key={s.id} className="card" style={{ marginBottom: "0.75rem", padding: "1rem" }}>
            <p className="admin-about-gallery-card-label muted admin-cell-muted">Spotlight {String(index + 1).padStart(2, "0")}</p>
            <CmsImageField label="Image" value={s.src} onChange={(v) => updateSpotlight(s.id, "src", v)} usage="card" />
            <label className="form-label">
              <span>Caption</span>
              <input className="input-field" value={s.caption} onChange={(e) => updateSpotlight(s.id, "caption", e.target.value)} />
            </label>
            <button type="button" className="btn btn-secondary admin-btn-sm" onClick={() => removeSpotlight(s.id)}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-secondary" onClick={addSpotlight}>
          Add spotlight image
        </button>
        <div style={{ marginTop: "1rem" }}>
          <button type="button" className="btn" disabled={saving || validationIssues.length > 0} onClick={() => void savePrograms()}>
            {saving ? "Saving…" : "Save spotlight"}
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Pathway section header</h2>
        <p className="muted admin-cell-muted">
          Main H2 and intro above the animated line on <strong>/programs</strong> (inside the pathway band).
        </p>
        <label className="form-label">
          <span>Pathway title</span>
          <input className="input-field" value={programsPathwayTitle} onChange={(e) => setProgramsPathwayTitle(e.target.value)} />
        </label>
        <label className="form-label">
          <span>Pathway intro</span>
          <textarea className="input-field" rows={3} value={programsPathwayBlurb} onChange={(e) => setProgramsPathwayBlurb(e.target.value)} />
        </label>
        <div style={{ marginTop: "1rem" }}>
          <button type="button" className="btn" disabled={saving || validationIssues.length > 0} onClick={() => void savePrograms()}>
            {saving ? "Saving…" : "Save pathway header"}
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Animated development pathway</h2>
        <p className="muted admin-cell-muted">
          Ordered nodes from <strong>start → end</strong> (e.g. U9 … U18). The public page draws a gradient line once, then runs a{" "}
          <strong>looping highlight</strong> along the same path. The vertical hint + small caps label match the hero “Explore squads”
          style. Needs <strong>at least two steps</strong> for the block to appear.
        </p>
        <label className="form-label">
          <span>Pathway block title</span>
          <input className="input-field" value={programsPathwayLineTitle} onChange={(e) => setProgramsPathwayLineTitle(e.target.value)} />
        </label>
        <label className="form-label">
          <span>Pathway block lead</span>
          <textarea className="input-field" rows={2} value={programsPathwayLineLead} onChange={(e) => setProgramsPathwayLineLead(e.target.value)} />
        </label>
        <label className="form-label">
          <span>Scroller hint (small caps, under animated line)</span>
          <input
            className="input-field"
            value={programsPathwayLineScrollLabel}
            onChange={(e) => setProgramsPathwayLineScrollLabel(e.target.value)}
            placeholder="Follow the pathway"
          />
        </label>
        <p className="muted admin-cell-muted" style={{ marginTop: "-0.35rem" }}>
          Same typography as hero “Explore squads”; keep it short (uppercase look is CSS).
        </p>

        <h3 className="page-section-title" style={{ marginTop: "1.1rem" }}>
          Steps (order = path direction)
        </h3>
        {programsPathwayLineItems.map((s, index) => (
          <div key={s.id} className="card" style={{ marginBottom: "0.75rem", padding: "1rem" }}>
            <p className="admin-about-gallery-card-label muted admin-cell-muted">
              Step {String(index + 1).padStart(2, "0")}
              {index === 0 ? " — start" : null}
              {index === programsPathwayLineItems.length - 1 ? " — end" : null}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.65rem" }}>
              <button
                type="button"
                className="btn btn-secondary admin-btn-sm"
                disabled={index === 0}
                onClick={() => movePathwayLineStep(s.id, -1)}
              >
                Move up
              </button>
              <button
                type="button"
                className="btn btn-secondary admin-btn-sm"
                disabled={index === programsPathwayLineItems.length - 1}
                onClick={() => movePathwayLineStep(s.id, 1)}
              >
                Move down
              </button>
            </div>
            <label className="form-label">
              <span>Node label (e.g. U9)</span>
              <input
                className="input-field"
                value={s.name}
                onChange={(e) =>
                  setProgramsPathwayLineItems((prev) => prev.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)))
                }
              />
            </label>
            <label className="form-label">
              <span>Description (hover / tap on mobile)</span>
              <textarea
                className="input-field"
                rows={2}
                value={s.description}
                onChange={(e) =>
                  setProgramsPathwayLineItems((prev) => prev.map((x) => (x.id === s.id ? { ...x, description: e.target.value } : x)))
                }
              />
            </label>
            <button
              type="button"
              className="btn btn-secondary admin-btn-sm"
              onClick={() => setProgramsPathwayLineItems((prev) => prev.filter((x) => x.id !== s.id))}
            >
              Remove step
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() =>
            setProgramsPathwayLineItems((prev) => [
              ...prev,
              { id: `pl-${Date.now()}`, name: "U16", description: "Short description for this stage on the pathway." }
            ])
          }
        >
          Add pathway step
        </button>
        <div style={{ marginTop: "1rem" }}>
          <button type="button" className="btn" disabled={saving || validationIssues.length > 0} onClick={() => void savePrograms()}>
            {saving ? "Saving…" : "Save development pathway"}
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Age group roster (CMS)</h2>
        <p className="muted admin-cell-muted">
          Stored for admin / future use — <strong>not</strong> shown as image cards on the public Programs page right now. Keep data in
          sync with your real squads if you use it elsewhere.
        </p>
        {groups.map((g, index) => (
          <div key={g.id} className="card" style={{ marginBottom: "0.75rem", padding: "1rem" }}>
            <p className="admin-about-gallery-card-label muted admin-cell-muted">Group {String(index + 1).padStart(2, "0")}</p>
            <div className="form-grid-responsive admin-form-grid--2">
              <label className="form-label">
                <span>Name (badge)</span>
                <input className="input-field" value={g.name} onChange={(e) => updateGroup(g.id, "name", e.target.value)} />
              </label>
            </div>
            <label className="form-label">
              <span>Description</span>
              <textarea
                className="input-field"
                rows={2}
                value={g.description}
                onChange={(e) => updateGroup(g.id, "description", e.target.value)}
              />
            </label>
            <CmsImageField
              label="Reference image"
              value={g.image ?? ""}
              onChange={(v) => updateGroup(g.id, "image", v)}
              usage="thumb"
              help="Optional path or upload."
            />
            <button type="button" className="btn btn-secondary admin-btn-sm" onClick={() => removeGroup(g.id)}>
              Remove group
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-secondary" onClick={addGroup}>
          Add age group
        </button>
        <div style={{ marginTop: "1rem" }}>
          <button type="button" className="btn" disabled={saving || validationIssues.length > 0} onClick={() => void savePrograms()}>
            {saving ? "Saving…" : "Save age groups"}
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Split block</h2>
        <p className="muted admin-cell-muted">Large image beside copy and quick actions (matches the middle of the public page).</p>
        <CmsImageField label="Large side image" value={programsSideImage} onChange={setProgramsSideImage} usage="section" />
        <label className="form-label">
          <span>Split title</span>
          <input className="input-field" value={programsSplitTitle} onChange={(e) => setProgramsSplitTitle(e.target.value)} />
        </label>
        <label className="form-label">
          <span>Split lead</span>
          <textarea className="input-field" rows={3} value={programsSplitLead} onChange={(e) => setProgramsSplitLead(e.target.value)} />
        </label>
        <div style={{ marginTop: "1rem" }}>
          <button type="button" className="btn" disabled={saving || validationIssues.length > 0} onClick={() => void savePrograms()}>
            {saving ? "Saving…" : "Save split"}
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Bottom CTA</h2>
        <p className="muted admin-cell-muted">Gradient band above the footer on /programs.</p>
        <label className="form-label">
          <span>CTA title</span>
          <input className="input-field" value={programsCtaTitle} onChange={(e) => setProgramsCtaTitle(e.target.value)} />
        </label>
        <label className="form-label">
          <span>CTA lead</span>
          <textarea className="input-field" rows={2} value={programsCtaLead} onChange={(e) => setProgramsCtaLead(e.target.value)} />
        </label>
        <div style={{ marginTop: "1rem" }}>
          <button type="button" className="btn" disabled={saving || validationIssues.length > 0} onClick={() => void savePrograms()}>
            {saving ? "Saving…" : "Save CTA"}
          </button>
        </div>
      </div>
    </section>
  );
}
