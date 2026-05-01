"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import type { SiteContent } from "@/lib/types";
import { cmsAdminPath } from "@/lib/cms-nav";
import {
  CmsAlert,
  CmsEditorLoadFailed,
  CmsFormActions,
  CmsImageField,
  CmsLoadingState,
  CmsPageHeader,
  CmsSection,
  CmsSubcard
} from "../_components/cms-shared";
import { useAdminSiteContent } from "../_lib/use-admin-site-content";

const HOME_SECTION_IDS = [
  "cms-home-hero",
  "cms-home-news",
  "cms-home-counters",
  "cms-home-highlights",
  "cms-home-story",
  "cms-home-performance",
  "cms-home-testimonial",
  "cms-home-faq",
  "cms-home-pathway-cta"
] as const;

const HOME_JUMP_LINKS: { id: (typeof HOME_SECTION_IDS)[number]; label: string }[] = [
  { id: "cms-home-hero", label: "Hero" },
  { id: "cms-home-news", label: "News" },
  { id: "cms-home-counters", label: "Counters" },
  { id: "cms-home-highlights", label: "Highlights" },
  { id: "cms-home-story", label: "Story" },
  { id: "cms-home-performance", label: "Performance" },
  { id: "cms-home-testimonial", label: "Testimonial" },
  { id: "cms-home-faq", label: "FAQ" },
  { id: "cms-home-pathway-cta", label: "Pathway & join" }
];

function HomeEditorHeroPreview({ pill, heading }: { pill: string; heading: string }) {
  const displayPill = pill.trim() || "Pill text";
  const displayHeading = heading.trim() || "Main headline goes here";
  return (
    <div className="home-editor-hero-preview" aria-hidden>
      <div className="home-editor-hero-preview__chrome">
        <span className="home-editor-hero-preview__dot" />
        <span className="home-editor-hero-preview__dot" />
        <span className="home-editor-hero-preview__dot" />
        <span className="home-editor-hero-preview__url">ftprlions.com · home</span>
      </div>
      <div className="home-editor-hero-preview__body">
        <span className="home-editor-hero-preview__pill">{displayPill}</span>
        <h4 className="home-editor-hero-preview__title">
          <span>{displayHeading}</span>
        </h4>
      </div>
    </div>
  );
}

function HomeEditorGaugeRing({ label, percent }: { label: string; percent: number }) {
  const uid = useId().replace(/:/g, "");
  const gradId = `hg-${uid}`;
  const r = 26;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = c * (1 - clamped / 100);
  return (
    <div className="home-editor-gauge">
      <div className="home-editor-gauge__ring">
        <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden>
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0ea5e9" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
          </defs>
          <circle cx="36" cy="36" r={r} fill="none" stroke="#e2e8f0" strokeWidth="7" />
          <circle
            cx="36"
            cy="36"
            r={r}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
          />
        </svg>
      </div>
      <div className="home-editor-gauge__meta">
        <p className="home-editor-gauge__pct">{clamped}%</p>
        <p className="home-editor-gauge__lab">{label.trim() || "Label"}</p>
      </div>
    </div>
  );
}

export function HomeEditor() {
  const { data, loading, err, saving, savePartial, load } = useAdminSiteContent();
  const [homeWelcomePill, setHomeWelcomePill] = useState("");
  const [homeHeroHeading, setHomeHeroHeading] = useState("");
  const [homeHeroImage, setHomeHeroImage] = useState("");
  const [homeHeroImages, setHomeHeroImages] = useState<SiteContent["homeHeroImages"]>({
    logo: ""
  });
  const [homeSectionImages, setHomeSectionImages] = useState<SiteContent["homeSectionImages"]>({
    pathway: "",
    training: "",
    iconLogo: ""
  });
  const [academyInfo, setAcademyInfo] = useState("");
  const [highlights, setHighlights] = useState<SiteContent["homeHighlightItems"]>([]);
  const [homeCounters, setHomeCounters] = useState<SiteContent["homeCounters"]>([]);
  const [homeCoachTitle, setHomeCoachTitle] = useState("");
  const [homeCoachBody, setHomeCoachBody] = useState("");
  const [homeEliteTitle, setHomeEliteTitle] = useState("");
  const [homeEliteBody, setHomeEliteBody] = useState("");
  const [homeMatchTitle, setHomeMatchTitle] = useState("");
  const [homeMatchDescription, setHomeMatchDescription] = useState("");
  const [homeTimetableTitle, setHomeTimetableTitle] = useState("");
  const [homeTimetableDescription, setHomeTimetableDescription] = useState("");
  const [homeDevelopmentLabel, setHomeDevelopmentLabel] = useState("");
  const [homeDevelopmentPercent, setHomeDevelopmentPercent] = useState(85);
  const [homeParentSatisfactionLabel, setHomeParentSatisfactionLabel] = useState("");
  const [homeParentSatisfactionPercent, setHomeParentSatisfactionPercent] = useState(92);
  const [homeTestimonial, setHomeTestimonial] = useState<SiteContent["homeTestimonial"]>({
    eyebrow: "",
    quote: "",
    name: "",
    role: "",
    imageSrc: "",
    imageAlt: ""
  });
  const [homeFaqItems, setHomeFaqItems] = useState<SiteContent["homeFaqItems"]>([]);
  const [homePathTitle, setHomePathTitle] = useState("");
  const [homePathLead, setHomePathLead] = useState("");
  const [homePathTeamsRaw, setHomePathTeamsRaw] = useState("");
  const [homeTrainingTitle, setHomeTrainingTitle] = useState("");
  const [homeTrainingLead, setHomeTrainingLead] = useState("");
  const [homeJoinTitle, setHomeJoinTitle] = useState("");
  const [homeJoinLead, setHomeJoinLead] = useState("");
  const [homeJoinButtonLabel, setHomeJoinButtonLabel] = useState("");
  const [saveToast, setSaveToast] = useState("");
  const [activeJump, setActiveJump] = useState<string>(HOME_SECTION_IDS[0]);
  const heroGlassRowTitleId = useId();

  const apply = useCallback((c: SiteContent) => {
    setHomeWelcomePill(c.homeWelcomePill);
    setHomeHeroHeading(c.homeHeroHeading);
    setHomeHeroImage(c.homeHeroImage ?? "");
    setHomeHeroImages({ ...c.homeHeroImages });
    setHomeSectionImages({ ...c.homeSectionImages });
    setAcademyInfo(c.academyInfo);
    setHighlights(c.homeHighlightItems.map((x) => ({ ...x })));
    setHomeCounters(c.homeCounters.map((x) => ({ ...x })));
    setHomeCoachTitle(c.homeCoachTitle);
    setHomeCoachBody(c.homeCoachBody);
    setHomeEliteTitle(c.homeEliteTitle);
    setHomeEliteBody(c.homeEliteBody);
    setHomeMatchTitle(c.homeMatchTitle);
    setHomeMatchDescription(c.homeMatchDescription);
    setHomeTimetableTitle(c.homeTimetableTitle);
    setHomeTimetableDescription(c.homeTimetableDescription);
    setHomeDevelopmentLabel(c.homeDevelopmentLabel);
    setHomeDevelopmentPercent(c.homeDevelopmentPercent);
    setHomeParentSatisfactionLabel(c.homeParentSatisfactionLabel);
    setHomeParentSatisfactionPercent(c.homeParentSatisfactionPercent);
    setHomeTestimonial({ ...c.homeTestimonial });
    setHomeFaqItems(c.homeFaqItems.map((x) => ({ ...x })));
    setHomePathTitle(c.homePathTitle);
    setHomePathLead(c.homePathLead);
    setHomePathTeamsRaw(c.homePathTeams.join(", "));
    setHomeTrainingTitle(c.homeTrainingTitle);
    setHomeTrainingLead(c.homeTrainingLead);
    setHomeJoinTitle(c.homeJoinTitle);
    setHomeJoinLead(c.homeJoinLead);
    setHomeJoinButtonLabel(c.homeJoinButtonLabel);
  }, []);

  useEffect(() => {
    if (data) apply(data);
  }, [data, apply]);

  useEffect(() => {
    if (!saveToast) return;
    const t = window.setTimeout(() => setSaveToast(""), 3200);
    return () => window.clearTimeout(t);
  }, [saveToast]);

  useEffect(() => {
    if (loading || !data) return;
    const nodes = HOME_SECTION_IDS.map((id) => document.getElementById(id)).filter((n): n is HTMLElement => Boolean(n));
    if (nodes.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0));
        const id = visible[0]?.target?.id;
        if (id && HOME_SECTION_IDS.includes(id as (typeof HOME_SECTION_IDS)[number])) setActiveJump(id);
      },
      { root: null, rootMargin: "-10% 0px -48% 0px", threshold: [0, 0.08, 0.2, 0.35] }
    );
    nodes.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [loading, data]);

  const homePathTeams = homePathTeamsRaw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  const validationIssues = useMemo(() => {
    const issues: string[] = [];
    if (!homeWelcomePill.trim()) issues.push("Hero pill text is required.");
    if (!homeHeroHeading.trim()) issues.push("Hero heading is required.");
    if (homeCounters.length === 0) issues.push("At least one counter is required.");
    if (homeCounters.some((c) => !c.title.trim() || c.end < 0)) issues.push("Each counter needs a title and non-negative value.");
    if (homeDevelopmentPercent < 0 || homeDevelopmentPercent > 100) issues.push("Player development percent must be 0-100.");
    if (homeParentSatisfactionPercent < 0 || homeParentSatisfactionPercent > 100) {
      issues.push("Parent satisfaction percent must be 0-100.");
    }
    if (homeFaqItems.some((f) => f.title.trim().length < 2 || f.content.trim().length < 2)) {
      issues.push("Each FAQ item needs at least 2 characters for title and content.");
    }
    if (!homeJoinButtonLabel.trim()) issues.push("Join button label is required.");
    if (homePathTeams.length === 0) issues.push("Add at least one team in Home path teams.");
    return issues;
  }, [
    homeWelcomePill,
    homeHeroHeading,
    homeCounters,
    homeDevelopmentPercent,
    homeParentSatisfactionPercent,
    homeFaqItems,
    homeJoinButtonLabel,
    homePathTeams.length
  ]);

  const heroLeadPreview = useMemo(() => {
    const bits = [
      homeWelcomePill.trim() ? `“${homeWelcomePill.trim()}”` : "",
      homeHeroHeading.trim()
        ? `${homeHeroHeading.trim().slice(0, 56)}${homeHeroHeading.trim().length > 56 ? "…" : ""}`
        : ""
    ].filter(Boolean);
    return bits.length ? bits.join(" · ") : "";
  }, [homeWelcomePill, homeHeroHeading]);

  async function savePage() {
    if (validationIssues.length > 0) return;
    const next = await savePartial({
      homeWelcomePill,
      homeHeroHeading,
      homeHeroImage: homeHeroImage || undefined,
      homeHeroImages,
      homeSectionImages,
      academyInfo,
      homeHighlightItems: highlights,
      homeCounters,
      homeCoachTitle,
      homeCoachBody,
      homeEliteTitle,
      homeEliteBody,
      homeMatchTitle,
      homeMatchDescription,
      homeTimetableTitle,
      homeTimetableDescription,
      homeDevelopmentLabel,
      homeDevelopmentPercent,
      homeParentSatisfactionLabel,
      homeParentSatisfactionPercent,
      homeTestimonial,
      homeFaqItems,
      homePathTitle,
      homePathLead,
      homePathTeams,
      homeTrainingTitle,
      homeTrainingLead,
      homeJoinTitle,
      homeJoinLead,
      homeJoinButtonLabel
    });
    if (next) setSaveToast("Homepage changes saved to the site.");
  }

  function updateHighlight(id: string, field: "title" | "body", v: string) {
    setHighlights((prev) => prev.map((h) => (h.id === id ? { ...h, [field]: v } : h)));
  }

  function addHighlight() {
    setHighlights((prev) => [...prev, { id: `hl-${Date.now()}`, title: "New highlight", body: "Description" }]);
  }

  function removeHighlight(id: string) {
    setHighlights((prev) => prev.filter((h) => h.id !== id));
  }

  function moveHighlight(id: string, dir: -1 | 1) {
    setHighlights((prev) => {
      const i = prev.findIndex((h) => h.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function updateCounter(id: string, field: "title" | "suffix" | "numberVariant" | "end", value: string | number) {
    setHomeCounters((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              [field]: field === "end" ? Number(value) || 0 : value
            }
          : c
      )
    );
  }

  function addCounter() {
    setHomeCounters((prev) => [...prev, { id: `hc-${Date.now()}`, end: 0, suffix: "+", title: "New stat", numberVariant: "default" }]);
  }

  function removeCounter(id: string) {
    setHomeCounters((prev) => prev.filter((c) => c.id !== id));
  }

  function moveCounter(id: string, dir: -1 | 1) {
    setHomeCounters((prev) => {
      const i = prev.findIndex((c) => c.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function updateFaq(id: string, field: "title" | "content", value: string) {
    setHomeFaqItems((prev) => prev.map((f) => (f.id === id ? { ...f, [field]: value } : f)));
  }

  function addFaq() {
    setHomeFaqItems((prev) => [...prev, { id: `faq-${Date.now()}`, title: "New question", content: "Answer" }]);
  }

  function removeFaq(id: string) {
    setHomeFaqItems((prev) => prev.filter((f) => f.id !== id));
  }

  function moveFaq(id: string, dir: -1 | 1) {
    setHomeFaqItems((prev) => {
      const i = prev.findIndex((f) => f.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  if (loading) {
    return <CmsLoadingState />;
  }

  if (!data) {
    return <CmsEditorLoadFailed err={err} load={load} />;
  }

  return (
    <section className="page-stack cms-editor-stack cms-editor-stack--home cms-editor-stack--cms">
      <CmsPageHeader
        title="Home"
        lead="Sections follow the public home page top-to-bottom. Each block has its own save. Use News for the home “News & updates” strip."
        previewHref="/"
      />

      <nav className="home-editor-jump" aria-label="Jump to homepage section">
        <p className="home-editor-jump__label">On this page</p>
        {HOME_JUMP_LINKS.map(({ id, label }) => (
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
            {validationIssues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </CmsAlert>
      ) : null}

      <CmsSection
        id="cms-home-hero"
        title="Hero"
        description="Top of the home page: headline, full-bleed background, then the two editable glass panels (professional and elite)."
      >
        <p className="cms-hero-overview-intro muted">
          Matches the live hero order: copy strip → background photo → glass panels (center mark is fixed outside this
          editor).
        </p>

        <HomeEditorHeroPreview pill={homeWelcomePill} heading={homeHeroHeading} />

        <div className="cms-hero-overview-grid">
          <div className="admin-stat-card cms-hero-stat-editor cms-hero-overview-card--full">
            <div className="admin-stat-card-icon admin-stat-card-icon--violet" aria-hidden>
              HL
            </div>
            <div className="admin-stat-card-body">
              <h3>Pill &amp; headline</h3>
              <p className="admin-stat-card-preview">{heroLeadPreview || "Shown above the main title on the home hero."}</p>
              <label className="form-label">
                <span>Pill text</span>
                <input className="input-field" value={homeWelcomePill} onChange={(e) => setHomeWelcomePill(e.target.value)} placeholder="e.g. Welcome" />
              </label>
              <label className="form-label">
                <span>Heading</span>
                <input className="input-field" value={homeHeroHeading} onChange={(e) => setHomeHeroHeading(e.target.value)} />
              </label>
            </div>
          </div>
        </div>

        <div className="cms-hero-overview-grid">
          <div className="admin-stat-card cms-hero-stat-editor cms-hero-overview-card--full">
            <div className="admin-stat-card-icon admin-stat-card-icon--emerald" aria-hidden>
              BG
            </div>
            <div className="admin-stat-card-body">
              <h3>Hero background</h3>
              <p className="cms-hero-stat-meta">Full-width image behind the headline on the public page.</p>
              <CmsImageField
                label="Main background image"
                value={homeHeroImage}
                onChange={setHomeHeroImage}
                usage="banner"
                help="Use a wide photo; it is cropped responsively on the site."
              />
            </div>
          </div>
        </div>

        <div className="home-editor-hero-strip" role="group" aria-labelledby={heroGlassRowTitleId}>
          <header className="home-editor-hero-strip__mast">
            <div className="home-editor-hero-strip__mast-copy">
              <p className="home-editor-hero-strip__kicker">Live layout</p>
              <h4 className="home-editor-hero-strip__title" id={heroGlassRowTitleId}>
                Hero glass row
              </h4>
              <p className="home-editor-hero-strip__lead">
                Edit the two glass panels on the public hero — professional on the left, elite on the right. The center
                mark is not changed here.
              </p>
              <ul className="home-editor-hero-strip__legend" aria-label="Glass panels on the public site">
                <li className="home-editor-hero-strip__legend-item home-editor-hero-strip__legend-item--pro">
                  <span className="home-editor-hero-strip__legend-dot" aria-hidden />
                  Professional
                </li>
                <li className="home-editor-hero-strip__legend-item home-editor-hero-strip__legend-item--elite">
                  <span className="home-editor-hero-strip__legend-dot" aria-hidden />
                  Elite
                </li>
              </ul>
            </div>
            <div className="home-editor-hero-strip__stage" aria-hidden="true">
              <div className="home-editor-hero-strip__stage-floor" />
              <div className="home-editor-hero-strip__panes">
                <div className="home-editor-hero-strip__pane home-editor-hero-strip__pane--pro">
                  <span className="home-editor-hero-strip__pane-label">L</span>
                </div>
                <div className="home-editor-hero-strip__pane home-editor-hero-strip__pane--elite">
                  <span className="home-editor-hero-strip__pane-label">R</span>
                </div>
              </div>
            </div>
          </header>
          <div className="home-editor-hero-strip__editors">
            <div className="home-editor-hero-triple">
              <article className="home-editor-hero-panel home-editor-hero-panel--left">
                <div className="home-editor-hero-panel__band">Professional · left</div>
                <div className="admin-stat-card cms-hero-stat-editor home-editor-hero-triple__card home-editor-hero-triple__card--left">
                  <div className="admin-stat-card-icon admin-stat-card-icon--sky" aria-hidden>
                    P1
                  </div>
                  <div className="admin-stat-card-body">
                    <h3>Professional card (left)</h3>
                    <p className="cms-hero-stat-meta">Left glass panel on the public hero.</p>
                    <label className="form-label">
                      <span>Title</span>
                      <input className="input-field" value={homeCoachTitle} onChange={(e) => setHomeCoachTitle(e.target.value)} />
                    </label>
                    <label className="form-label">
                      <span>Body</span>
                      <textarea className="input-field" rows={3} value={homeCoachBody} onChange={(e) => setHomeCoachBody(e.target.value)} />
                    </label>
                  </div>
                </div>
              </article>

              <article className="home-editor-hero-panel home-editor-hero-panel--right">
                <div className="home-editor-hero-panel__band">Elite · right</div>
                <div className="admin-stat-card cms-hero-stat-editor home-editor-hero-triple__card home-editor-hero-triple__card--right">
                  <div className="admin-stat-card-icon admin-stat-card-icon--violet" aria-hidden>
                    E1
                  </div>
                  <div className="admin-stat-card-body">
                    <h3>Elite card (right)</h3>
                    <p className="cms-hero-stat-meta">Right glass panel on the public hero.</p>
                    <label className="form-label">
                      <span>Title</span>
                      <input className="input-field" value={homeEliteTitle} onChange={(e) => setHomeEliteTitle(e.target.value)} />
                    </label>
                    <label className="form-label">
                      <span>Body</span>
                      <textarea className="input-field" rows={3} value={homeEliteBody} onChange={(e) => setHomeEliteBody(e.target.value)} />
                    </label>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </div>

        <CmsFormActions primaryLabel="Save hero" onPrimary={() => void savePage()} disabled={validationIssues.length > 0} saving={saving} />
      </CmsSection>

      <CmsSection id="cms-home-news" title="News strip" description="Placed directly under the hero on the home page (up to three cards).">
        <p className="muted" style={{ margin: 0 }}>
          Edit titles, dates, images, and copy on the News content page. Cards appear in the same order on the live &quot;News &amp;
          updates&quot; row.
        </p>
        <p style={{ marginTop: "0.85rem" }}>
          <Link className="btn btn-secondary" href={cmsAdminPath("news")}>
            Open News editor
          </Link>
        </p>
      </CmsSection>

      <CmsSection
        id="cms-home-counters"
        title="Counters"
        description="Animated stat strip on the home page, directly under the news row and above the three highlight cards."
      >
        {homeCounters.length > 0 ? (
          <div className="home-editor-counter-strip" aria-label="Counter preview">
            {homeCounters.map((c) => (
              <div
                key={`prev-${c.id}`}
                className="home-editor-counter-chip"
                title={c.title}
              >
                <span
                  className={`home-editor-counter-chip__val${c.numberVariant === "accent" ? " home-editor-counter-chip__val--accent" : ""}`}
                >
                  {c.end}
                  {c.suffix}
                </span>
                <span className="home-editor-counter-chip__lab">{c.title || "Untitled"}</span>
              </div>
            ))}
          </div>
        ) : null}
        {homeCounters.map((c, idx) => (
          <CmsSubcard
            key={c.id}
            label="Counter"
            actions={
              <>
                <div className="home-editor-reorder">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={idx === 0}
                    onClick={() => moveCounter(c.id, -1)}
                    aria-label="Move counter up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={idx === homeCounters.length - 1}
                    onClick={() => moveCounter(c.id, 1)}
                    aria-label="Move counter down"
                  >
                    ↓
                  </button>
                </div>
                <button type="button" className="btn btn-secondary admin-btn-sm" onClick={() => removeCounter(c.id)}>
                  Remove counter
                </button>
              </>
            }
          >
            <div className="form-grid-responsive admin-form-grid--2">
              <label className="form-label">
                <span>Title</span>
                <input className="input-field" value={c.title} onChange={(e) => updateCounter(c.id, "title", e.target.value)} />
              </label>
              <label className="form-label">
                <span>Value</span>
                <input className="input-field" type="number" min={0} value={c.end} onChange={(e) => updateCounter(c.id, "end", Number(e.target.value))} />
              </label>
              <label className="form-label">
                <span>Suffix</span>
                <input className="input-field" value={c.suffix} onChange={(e) => updateCounter(c.id, "suffix", e.target.value)} />
              </label>
              <label className="form-label">
                <span>Accent style</span>
                <select className="input-field" value={c.numberVariant ?? "default"} onChange={(e) => updateCounter(c.id, "numberVariant", e.target.value)}>
                  <option value="default">Default</option>
                  <option value="accent">Accent</option>
                </select>
              </label>
            </div>
          </CmsSubcard>
        ))}
        <button type="button" className="btn btn-secondary" onClick={addCounter}>
          Add counter
        </button>
        <CmsFormActions
          primaryLabel="Save counters"
          onPrimary={() => void savePage()}
          disabled={validationIssues.length > 0}
          saving={saving}
        />
      </CmsSection>

      <CmsSection
        id="cms-home-highlights"
        title="Highlights"
        description="Three cards in a row below the counter strip on the public home page."
      >
        <div className="home-editor-highlights-grid">
          {highlights.map((h, idx) => (
          <CmsSubcard
            key={h.id}
            label={`Highlight`}
            actions={
              <>
                <div className="home-editor-reorder">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={idx === 0}
                    onClick={() => moveHighlight(h.id, -1)}
                    aria-label="Move highlight up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={idx === highlights.length - 1}
                    onClick={() => moveHighlight(h.id, 1)}
                    aria-label="Move highlight down"
                  >
                    ↓
                  </button>
                </div>
                <button type="button" className="btn btn-secondary admin-btn-sm" onClick={() => removeHighlight(h.id)}>
                  Remove
                </button>
              </>
            }
          >
            <label className="form-label">
              <span>Title</span>
              <input className="input-field" value={h.title} onChange={(e) => updateHighlight(h.id, "title", e.target.value)} />
            </label>
            <label className="form-label">
              <span>Body</span>
              <textarea className="input-field" rows={2} value={h.body} onChange={(e) => updateHighlight(h.id, "body", e.target.value)} />
            </label>
          </CmsSubcard>
        ))}
        </div>
        <CmsFormActions
          primaryLabel="Save highlights"
          onPrimary={() => void savePage()}
          disabled={validationIssues.length > 0}
          saving={saving}
          secondary={
            <button type="button" className="btn btn-secondary" onClick={addHighlight}>
              Add highlight
            </button>
          }
        />
      </CmsSection>

      <CmsSection
        id="cms-home-story"
        title="Academy story"
        description="The full-width “Shaping Tomorrow…” card that opens the lower stack on the home page (before the two-column performance row)."
      >
        <p className="muted" style={{ marginTop: 0 }}>
          Heading text is fixed in the theme for now; only the body copy below it is editable here.
        </p>
        <label className="form-label">
          <span>Body text</span>
          <textarea className="input-field" rows={5} value={academyInfo} onChange={(e) => setAcademyInfo(e.target.value)} />
        </label>
        <CmsFormActions
          primaryLabel="Save academy story"
          onPrimary={() => void savePage()}
          disabled={validationIssues.length > 0}
          saving={saving}
        />
      </CmsSection>

      <CmsSection
        id="cms-home-performance"
        title="Match, timetable & progress"
        description="Two-column block on the home page: match + timetable on the left, progress bars on the right."
      >
        <p className="muted" style={{ marginTop: 0 }}>
          Same order as the live layout: match tile (with logo icon), timetable tile, then the two percentage bars.
        </p>
        <CmsImageField
          label="Match tile icon (logo)"
          value={homeSectionImages.iconLogo}
          onChange={(v) => setHomeSectionImages((p) => ({ ...p, iconLogo: v }))}
          usage="logo"
          help="Small mark shown next to the match title in the left column."
        />
        <div className="form-grid-responsive admin-form-grid--2">
          <label className="form-label">
            <span>Match title</span>
            <input className="input-field" value={homeMatchTitle} onChange={(e) => setHomeMatchTitle(e.target.value)} />
          </label>
          <label className="form-label">
            <span>Timetable title</span>
            <input className="input-field" value={homeTimetableTitle} onChange={(e) => setHomeTimetableTitle(e.target.value)} />
          </label>
        </div>
        <label className="form-label">
          <span>Match description</span>
          <textarea className="input-field" rows={2} value={homeMatchDescription} onChange={(e) => setHomeMatchDescription(e.target.value)} />
        </label>
        <label className="form-label">
          <span>Timetable description</span>
          <textarea className="input-field" rows={2} value={homeTimetableDescription} onChange={(e) => setHomeTimetableDescription(e.target.value)} />
        </label>
        <h3 className="page-section-title">Progress bars (right column)</h3>
        <div className="home-editor-gauges" aria-label="Progress ring preview">
          <HomeEditorGaugeRing label={homeDevelopmentLabel} percent={homeDevelopmentPercent} />
          <HomeEditorGaugeRing label={homeParentSatisfactionLabel} percent={homeParentSatisfactionPercent} />
        </div>
        <div className="form-grid-responsive admin-form-grid--2">
          <label className="form-label">
            <span>Progress label</span>
            <input className="input-field" value={homeDevelopmentLabel} onChange={(e) => setHomeDevelopmentLabel(e.target.value)} />
          </label>
          <label className="form-label">
            <span>Progress %</span>
            <input className="input-field" type="number" min={0} max={100} value={homeDevelopmentPercent} onChange={(e) => setHomeDevelopmentPercent(Number(e.target.value))} />
          </label>
          <label className="form-label">
            <span>Parent label</span>
            <input className="input-field" value={homeParentSatisfactionLabel} onChange={(e) => setHomeParentSatisfactionLabel(e.target.value)} />
          </label>
          <label className="form-label">
            <span>Parent %</span>
            <input className="input-field" type="number" min={0} max={100} value={homeParentSatisfactionPercent} onChange={(e) => setHomeParentSatisfactionPercent(Number(e.target.value))} />
          </label>
        </div>
        <CmsFormActions
          primaryLabel="Save match & progress"
          onPrimary={() => void savePage()}
          disabled={validationIssues.length > 0}
          saving={saving}
        />
      </CmsSection>

      <CmsSection id="cms-home-testimonial" title="Testimonial" description="Parent quote card directly under the two-column performance block.">
        <div className="form-grid-responsive admin-form-grid--2">
          <label className="form-label">
            <span>Eyebrow</span>
            <input className="input-field" value={homeTestimonial.eyebrow} onChange={(e) => setHomeTestimonial((p) => ({ ...p, eyebrow: e.target.value }))} />
          </label>
          <label className="form-label">
            <span>Name</span>
            <input className="input-field" value={homeTestimonial.name} onChange={(e) => setHomeTestimonial((p) => ({ ...p, name: e.target.value }))} />
          </label>
          <label className="form-label">
            <span>Role</span>
            <input className="input-field" value={homeTestimonial.role} onChange={(e) => setHomeTestimonial((p) => ({ ...p, role: e.target.value }))} />
          </label>
          <label className="form-label">
            <span>Image alt</span>
            <input className="input-field" value={homeTestimonial.imageAlt} onChange={(e) => setHomeTestimonial((p) => ({ ...p, imageAlt: e.target.value }))} />
          </label>
        </div>
        <CmsImageField
          label="Parent testimonial image (Parent, FTPR Lions family)"
          value={homeTestimonial.imageSrc}
          onChange={(v) => setHomeTestimonial((p) => ({ ...p, imageSrc: v }))}
          usage="thumb"
        />
        <label className="form-label">
          <span>Quote</span>
          <textarea className="input-field" rows={3} value={homeTestimonial.quote} onChange={(e) => setHomeTestimonial((p) => ({ ...p, quote: e.target.value }))} />
        </label>
        <CmsFormActions
          primaryLabel="Save testimonial"
          onPrimary={() => void savePage()}
          disabled={validationIssues.length > 0}
          saving={saving}
        />
      </CmsSection>

      <CmsSection id="cms-home-faq" title="FAQ" description="Accordion on the home page below the testimonial.">
        {homeFaqItems.map((f, idx) => (
          <CmsSubcard
            key={f.id}
            label="FAQ item"
            actions={
              <>
                <div className="home-editor-reorder">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={idx === 0}
                    onClick={() => moveFaq(f.id, -1)}
                    aria-label="Move FAQ up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={idx === homeFaqItems.length - 1}
                    onClick={() => moveFaq(f.id, 1)}
                    aria-label="Move FAQ down"
                  >
                    ↓
                  </button>
                </div>
                <button type="button" className="btn btn-secondary admin-btn-sm" onClick={() => removeFaq(f.id)}>
                  Remove FAQ
                </button>
              </>
            }
          >
            <label className="form-label">
              <span>Question</span>
              <input className="input-field" value={f.title} onChange={(e) => updateFaq(f.id, "title", e.target.value)} />
            </label>
            <label className="form-label">
              <span>Answer</span>
              <textarea className="input-field" rows={2} value={f.content} onChange={(e) => updateFaq(f.id, "content", e.target.value)} />
            </label>
          </CmsSubcard>
        ))}
        <CmsFormActions
          primaryLabel="Save FAQ"
          onPrimary={() => void savePage()}
          disabled={validationIssues.length > 0}
          saving={saving}
          secondary={
            <button type="button" className="btn btn-secondary" onClick={addFaq}>
              Add FAQ
            </button>
          }
        />
      </CmsSection>

      <CmsSection
        id="cms-home-pathway-cta"
        title="Pathway, training & join"
        description="Bottom of the home stack: pathway two-column block, training two-column block, then centered join CTA."
      >
        <p className="muted" style={{ marginTop: 0 }}>
          Images map to the photo panels beside pathway and training copy; the match logo is edited under “Match, timetable & progress”.
        </p>
        <div className="form-grid-responsive admin-form-grid--2">
          <CmsImageField
            label="Your Path to Football Excellence image"
            value={homeSectionImages.pathway}
            onChange={(v) => setHomeSectionImages((p) => ({ ...p, pathway: v }))}
            usage="section"
          />
          <CmsImageField
            label="Training & Schedule image"
            value={homeSectionImages.training}
            onChange={(v) => setHomeSectionImages((p) => ({ ...p, training: v }))}
            usage="section"
          />
        </div>
        <label className="form-label">
          <span>Pathway title (supports {`{{highlight}}`})</span>
          <input className="input-field" value={homePathTitle} onChange={(e) => setHomePathTitle(e.target.value)} />
        </label>
        <label className="form-label">
          <span>Pathway lead</span>
          <textarea className="input-field" rows={2} value={homePathLead} onChange={(e) => setHomePathLead(e.target.value)} />
        </label>
        <label className="form-label">
          <span>Pathway teams (comma separated)</span>
          <input className="input-field" value={homePathTeamsRaw} onChange={(e) => setHomePathTeamsRaw(e.target.value)} />
        </label>
        <div className="form-grid-responsive admin-form-grid--2">
          <label className="form-label">
            <span>Training section title</span>
            <input className="input-field" value={homeTrainingTitle} onChange={(e) => setHomeTrainingTitle(e.target.value)} />
          </label>
          <label className="form-label">
            <span>Join section title</span>
            <input className="input-field" value={homeJoinTitle} onChange={(e) => setHomeJoinTitle(e.target.value)} />
          </label>
        </div>
        <label className="form-label">
          <span>Training lead</span>
          <textarea className="input-field" rows={2} value={homeTrainingLead} onChange={(e) => setHomeTrainingLead(e.target.value)} />
        </label>
        <label className="form-label">
          <span>Join lead</span>
          <textarea className="input-field" rows={2} value={homeJoinLead} onChange={(e) => setHomeJoinLead(e.target.value)} />
        </label>
        <label className="form-label">
          <span>Join button label</span>
          <input className="input-field" value={homeJoinButtonLabel} onChange={(e) => setHomeJoinButtonLabel(e.target.value)} />
        </label>
        <CmsFormActions
          primaryLabel="Save pathway & join"
          onPrimary={() => void savePage()}
          disabled={validationIssues.length > 0}
          saving={saving}
        />
      </CmsSection>

      {saveToast ? (
        <div className="home-editor-save-toast" role="status" aria-live="polite">
          <span aria-hidden>✓</span> {saveToast}
        </div>
      ) : null}
    </section>
  );
}
