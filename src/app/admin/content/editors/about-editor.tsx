"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import type { SiteContent } from "@/lib/types";
import {
  CmsAlert,
  CmsEditorLoadFailed,
  CmsFormActions,
  CmsImageField,
  CmsLoadingState,
  CmsPageHeader,
  CmsSection
} from "../_components/cms-shared";
import { useAdminSiteContent } from "../_lib/use-admin-site-content";

function galleryCaptionPreview(caption: string) {
  const sep = " — ";
  const i = caption.indexOf(sep);
  if (i === -1) {
    if (!caption.trim()) return null;
    return (
      <p className="muted admin-cell-muted admin-about-caption-preview">
        Public card shows one strong line. Add “ — ” (space, em dash, space) to split into headline + subtitle.
      </p>
    );
  }
  const lead = caption.slice(0, i).trim();
  const detail = caption.slice(i + sep.length).trim();
  return (
    <p className="muted admin-cell-muted admin-about-caption-preview">
      Preview: <strong>{lead || "…"}</strong>
      {detail ? <> — {detail}</> : null}
    </p>
  );
}

const ABOUT_JUMP = [
  { id: "cms-about-hero", label: "Hero" },
  { id: "cms-about-vision", label: "Vision" },
  { id: "cms-about-gallery", label: "Gallery" },
  { id: "cms-about-values", label: "Values" },
  { id: "cms-about-split-cta", label: "Split & CTA" }
] as const;

export function AboutEditor() {
  const { data, loading, err, saving, savePartial, load } = useAdminSiteContent();
  const [activeJump, setActiveJump] = useState<string>(ABOUT_JUMP[0].id);
  const jumpNavLabelId = useId();
  const [aboutPagePill, setAboutPagePill] = useState("");
  const [aboutPageTitle, setAboutPageTitle] = useState("");
  const [aboutHeroImage, setAboutHeroImage] = useState("");
  const [aboutPageLead, setAboutPageLead] = useState("");
  const [aboutVisionTitle, setAboutVisionTitle] = useState("");
  const [academyInfo, setAcademyInfo] = useState("");
  const [aboutGalleryItems, setAboutGalleryItems] = useState<SiteContent["aboutGalleryItems"]>([]);
  const [aboutValuesTitle, setAboutValuesTitle] = useState("");
  const [aboutPageImage, setAboutPageImage] = useState("");
  const [aboutSplitTitle, setAboutSplitTitle] = useState("");
  const [aboutSplitLead, setAboutSplitLead] = useState("");
  const [tiles, setTiles] = useState<SiteContent["aboutTiles"]>([]);
  const [aboutCtaTitle, setAboutCtaTitle] = useState("");
  const [aboutCtaLead, setAboutCtaLead] = useState("");

  const apply = useCallback((c: SiteContent) => {
    setAboutPagePill(c.aboutPagePill);
    setAboutPageTitle(c.aboutPageTitle);
    setAboutHeroImage(c.aboutHeroImage ?? "");
    setAboutPageLead(c.aboutPageLead);
    setAboutVisionTitle(c.aboutVisionTitle);
    setAcademyInfo(c.academyInfo);
    setAboutGalleryItems(c.aboutGalleryItems.map((x) => ({ ...x })));
    setAboutValuesTitle(c.aboutValuesTitle);
    setAboutPageImage(c.aboutPageImage);
    setAboutSplitTitle(c.aboutSplitTitle);
    setAboutSplitLead(c.aboutSplitLead);
    setTiles(c.aboutTiles.map((t) => ({ ...t })));
    setAboutCtaTitle(c.aboutCtaTitle);
    setAboutCtaLead(c.aboutCtaLead);
  }, []);

  useEffect(() => {
    if (data) apply(data);
  }, [data, apply]);

  useEffect(() => {
    const ids = ABOUT_JUMP.map((j) => j.id);
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (els.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) setActiveJump(visible.target.id);
      },
      { rootMargin: "-18% 0px -52% 0px", threshold: [0, 0.15, 0.35, 0.55, 0.75, 1] }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const validationIssues = useMemo(() => {
    const issues: string[] = [];
    if (!aboutPagePill.trim()) issues.push("Hero pill label is required.");
    if (!aboutPageTitle.trim()) issues.push("Page title (H1) is required.");
    if (!aboutPageLead.trim()) issues.push("Hero lead is required.");
    if (!aboutVisionTitle.trim()) issues.push("Vision section title is required.");
    if (academyInfo.trim().length < 12) issues.push("Vision / story text should be at least 12 characters.");
    aboutGalleryItems.forEach((g, idx) => {
      const n = idx + 1;
      if (!g.src.trim()) issues.push(`Gallery image ${n}: set a path or upload an image.`);
      if (g.caption.trim().length < 2) issues.push(`Gallery image ${n}: caption needs at least 2 characters.`);
    });
    if (!aboutValuesTitle.trim()) issues.push("Values section title is required.");
    if (tiles.length === 0) issues.push("Add at least one value card.");
    if (tiles.some((t) => !t.title.trim() || t.title.trim().length < 2)) {
      issues.push("Each value card needs a title (at least 2 characters).");
    }
    if (tiles.some((t) => !t.body.trim() || t.body.trim().length < 2)) {
      issues.push("Each value card needs a body (at least 2 characters).");
    }
    if (!aboutSplitTitle.trim()) issues.push("Split section title is required.");
    if (!aboutSplitLead.trim()) issues.push("Split section lead is required.");
    if (!aboutPageImage.trim()) issues.push("Large side image path is required.");
    if (!aboutCtaTitle.trim()) issues.push("Bottom CTA title is required.");
    if (!aboutCtaLead.trim()) issues.push("Bottom CTA lead is required.");
    return issues;
  }, [
    aboutPagePill,
    aboutPageTitle,
    aboutPageLead,
    aboutVisionTitle,
    academyInfo,
    aboutGalleryItems,
    aboutValuesTitle,
    tiles,
    aboutSplitTitle,
    aboutSplitLead,
    aboutPageImage,
    aboutCtaTitle,
    aboutCtaLead
  ]);

  const aboutPayload = useMemo(
    () => ({
      aboutPagePill,
      aboutPageTitle,
      aboutHeroImage: aboutHeroImage.trim() || undefined,
      aboutPageLead,
      aboutVisionTitle,
      academyInfo,
      aboutGalleryItems,
      aboutValuesTitle,
      aboutPageImage,
      aboutSplitTitle,
      aboutSplitLead,
      aboutTiles: tiles,
      aboutCtaTitle,
      aboutCtaLead
    }),
    [
      aboutPagePill,
      aboutPageTitle,
      aboutHeroImage,
      aboutPageLead,
      aboutVisionTitle,
      academyInfo,
      aboutGalleryItems,
      aboutValuesTitle,
      aboutPageImage,
      aboutSplitTitle,
      aboutSplitLead,
      tiles,
      aboutCtaTitle,
      aboutCtaLead
    ]
  );

  async function saveAbout() {
    if (validationIssues.length > 0) return;
    await savePartial(aboutPayload);
  }

  function setTile(id: string, field: "title" | "body", v: string) {
    setTiles((t) => t.map((x) => (x.id === id ? { ...x, [field]: v } : x)));
  }

  function addTile() {
    setTiles((prev) => [
      ...prev,
      { id: `abt-${Date.now()}`, title: "New value", body: "Short description for this pillar." }
    ]);
  }

  function removeTile(id: string) {
    setTiles((prev) => prev.filter((t) => t.id !== id));
  }

  function updateGallery(id: string, field: "src" | "caption", v: string) {
    setAboutGalleryItems((prev) => prev.map((g) => (g.id === id ? { ...g, [field]: v } : g)));
  }

  function addGalleryItem() {
    setAboutGalleryItems((prev) => [
      ...prev,
      {
        id: `ag-${Date.now()}`,
        src: "/gallery/FTPR_49.JPG",
        caption: "Headline — supporting line"
      }
    ]);
  }

  function removeGalleryItem(id: string) {
    setAboutGalleryItems((prev) => prev.filter((g) => g.id !== id));
  }

  if (loading) {
    return <CmsLoadingState message="Loading about editor…" />;
  }

  if (!data) {
    return <CmsEditorLoadFailed err={err} load={load} />;
  }

  return (
    <section className="page-stack cms-editor-stack cms-editor-stack--cms">
      <CmsPageHeader
        title="About"
        lead="Sections follow the public /about page top-to-bottom. Each block has its own save. Vision text is shared with Home → Academy story."
        previewHref="/about"
      />

      <nav className="home-editor-jump" aria-labelledby={jumpNavLabelId}>
        <p className="home-editor-jump__label" id={jumpNavLabelId}>
          On this page
        </p>
        {ABOUT_JUMP.map(({ id, label }) => (
          <a
            key={id}
            href={`#${id}`}
            className={`home-editor-jump__link${activeJump === id ? " home-editor-jump__link--active" : ""}`}
            onClick={() => setActiveJump(id)}
          >
            {label}
          </a>
        ))}
      </nav>

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

      <CmsSection
        id="cms-about-hero"
        title="Hero"
        description="Full-bleed top of /about — pill, title, lead, and background image."
      >
        <div className="form-grid-responsive admin-form-grid--2">
          <label className="form-label">
            <span>Pill label</span>
            <input className="input-field" value={aboutPagePill} onChange={(e) => setAboutPagePill(e.target.value)} />
          </label>
          <label className="form-label">
            <span>Page title (H1)</span>
            <input className="input-field" value={aboutPageTitle} onChange={(e) => setAboutPageTitle(e.target.value)} />
          </label>
        </div>
        <label className="form-label">
          <span>Hero lead</span>
          <textarea className="input-field" rows={3} value={aboutPageLead} onChange={(e) => setAboutPageLead(e.target.value)} />
        </label>
        <CmsImageField
          label="Hero background (full-width)"
          value={aboutHeroImage}
          onChange={setAboutHeroImage}
          usage="banner"
          help="Optional — falls back to a default if empty."
        />
        <CmsFormActions
          primaryLabel="Save hero"
          onPrimary={() => void saveAbout()}
          disabled={validationIssues.length > 0}
          saving={saving}
        />
      </CmsSection>

      <CmsSection
        id="cms-about-vision"
        title="Vision & story"
        description="First content card on /about after the hero. Same vision copy as Home → Academy story."
      >
        <label className="form-label">
          <span>Vision section title</span>
          <input className="input-field" value={aboutVisionTitle} onChange={(e) => setAboutVisionTitle(e.target.value)} />
        </label>
        <label className="form-label">
          <span>Vision / story</span>
          <textarea className="input-field" rows={6} value={academyInfo} onChange={(e) => setAcademyInfo(e.target.value)} />
        </label>
        <CmsFormActions
          primaryLabel="Save vision"
          onPrimary={() => void saveAbout()}
          disabled={validationIssues.length > 0}
          saving={saving}
        />
      </CmsSection>

      <CmsSection
        id="cms-about-gallery"
        title="Gallery"
        description="Academy moments grid on /about. Use “ — ” (space, em dash, space) in captions to split headline and subtitle."
      >
        {aboutGalleryItems.map((g, index) => (
          <div key={g.id} className="card" style={{ marginBottom: "0.75rem", padding: "1rem" }}>
            <p className="admin-about-gallery-card-label muted admin-cell-muted">
              Gallery card {String(index + 1).padStart(2, "0")}
            </p>
            <CmsImageField label="Image" value={g.src} onChange={(v) => updateGallery(g.id, "src", v)} usage="card" />
            <label className="form-label">
              <span>Caption</span>
              <input className="input-field" value={g.caption} onChange={(e) => updateGallery(g.id, "caption", e.target.value)} />
            </label>
            {galleryCaptionPreview(g.caption)}
            <button type="button" className="btn btn-secondary admin-btn-sm" onClick={() => removeGalleryItem(g.id)}>
              Remove
            </button>
          </div>
        ))}
        <CmsFormActions
          primaryLabel="Save gallery"
          onPrimary={() => void saveAbout()}
          disabled={validationIssues.length > 0}
          saving={saving}
          secondary={
            <button type="button" className="btn btn-secondary" onClick={addGalleryItem}>
              Add gallery image
            </button>
          }
        />
      </CmsSection>

      <CmsSection
        id="cms-about-values"
        title="Values"
        description="“What we stand for” grid — short value cards with title and body."
      >
        <label className="form-label">
          <span>Values section title</span>
          <input className="input-field" value={aboutValuesTitle} onChange={(e) => setAboutValuesTitle(e.target.value)} />
        </label>
        {tiles.map((t) => (
          <div key={t.id} className="card" style={{ marginBottom: "0.75rem", padding: "1rem" }}>
            <label className="form-label">
              <span>Title</span>
              <input className="input-field" value={t.title} onChange={(e) => setTile(t.id, "title", e.target.value)} />
            </label>
            <label className="form-label">
              <span>Body</span>
              <textarea className="input-field" rows={2} value={t.body} onChange={(e) => setTile(t.id, "body", e.target.value)} />
            </label>
            <button type="button" className="btn btn-secondary admin-btn-sm" onClick={() => removeTile(t.id)}>
              Remove value card
            </button>
          </div>
        ))}
        <CmsFormActions
          primaryLabel="Save values"
          onPrimary={() => void saveAbout()}
          disabled={validationIssues.length > 0}
          saving={saving}
          secondary={
            <button type="button" className="btn btn-secondary" onClick={addTile}>
              Add value card
            </button>
          }
        />
      </CmsSection>

      <CmsSection
        id="cms-about-split-cta"
        title="Split & bottom CTA"
        description="Two-column block (copy + buttons) and large image, then the gradient CTA band at the bottom of /about."
      >
        <h3 className="page-section-title">Split section</h3>
        <div className="form-grid-responsive admin-form-grid--2">
          <label className="form-label">
            <span>Split title</span>
            <input className="input-field" value={aboutSplitTitle} onChange={(e) => setAboutSplitTitle(e.target.value)} />
          </label>
        </div>
        <label className="form-label">
          <span>Split lead</span>
          <textarea className="input-field" rows={3} value={aboutSplitLead} onChange={(e) => setAboutSplitLead(e.target.value)} />
        </label>
        <CmsImageField label="Large side image" value={aboutPageImage} onChange={setAboutPageImage} usage="section" />

        <h3 className="page-section-title" style={{ marginTop: "1.25rem" }}>
          Bottom CTA
        </h3>
        <div className="form-grid-responsive admin-form-grid--2">
          <label className="form-label">
            <span>CTA title</span>
            <input className="input-field" value={aboutCtaTitle} onChange={(e) => setAboutCtaTitle(e.target.value)} />
          </label>
        </div>
        <label className="form-label">
          <span>CTA lead</span>
          <textarea className="input-field" rows={2} value={aboutCtaLead} onChange={(e) => setAboutCtaLead(e.target.value)} />
        </label>
        <CmsFormActions
          primaryLabel="Save split & CTA"
          onPrimary={() => void saveAbout()}
          disabled={validationIssues.length > 0}
          saving={saving}
        />
      </CmsSection>
    </section>
  );
}
