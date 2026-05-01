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

export function TeamEditor() {
  const { data, loading, err, saving, savePartial, load } = useAdminSiteContent();
  const [ourTeamPageTitle, setOurTeamPageTitle] = useState("");
  const [ourTeamPageLead, setOurTeamPageLead] = useState("");
  const [members, setMembers] = useState<SiteContent["teamMembers"]>([]);

  const apply = useCallback((c: SiteContent) => {
    setOurTeamPageTitle(c.ourTeamPageTitle);
    setOurTeamPageLead(c.ourTeamPageLead);
    setMembers(c.teamMembers.map((m) => ({ ...m })));
  }, []);

  useEffect(() => {
    if (data) apply(data);
  }, [data, apply]);

  if (loading) return <CmsLoadingState message="Loading team editor…" />;

  if (!data) return <CmsEditorLoadFailed err={err} load={load} />;

  return (
    <section className="page-stack cms-editor-stack cms-editor-stack--cms">
      <CmsPageHeader
        title="Our Team"
        lead="Page header and staff cards on /our-team — same order as the public page."
        previewHref="/our-team"
      />
      <CmsSection id="cms-team-page" title="Page & members" description="Title, lead, then each coach card (name, role, bio, photo).">
        <label className="form-label">
          <span>Page title</span>
          <input className="input-field" value={ourTeamPageTitle} onChange={(e) => setOurTeamPageTitle(e.target.value)} />
        </label>
        <label className="form-label">
          <span>Page lead</span>
          <textarea className="input-field" rows={2} value={ourTeamPageLead} onChange={(e) => setOurTeamPageLead(e.target.value)} />
        </label>
        {members.map((m, idx) => (
          <div key={m.id} className="card" style={{ marginBottom: "0.75rem", padding: "1rem" }}>
            <p className="muted admin-cell-muted">Member {idx + 1}</p>
            <label className="form-label">
              <span>Name</span>
              <input
                className="input-field"
                value={m.name}
                onChange={(e) => setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, name: e.target.value } : x)))}
              />
            </label>
            <label className="form-label">
              <span>Role</span>
              <input
                className="input-field"
                value={m.role}
                onChange={(e) => setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, role: e.target.value } : x)))}
              />
            </label>
            <label className="form-label">
              <span>Description</span>
              <textarea
                className="input-field"
                rows={2}
                value={m.description}
                onChange={(e) =>
                  setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, description: e.target.value } : x)))
                }
              />
            </label>
            <CmsImageField
              label="Photo URL"
              value={m.image}
              onChange={(url) => setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, image: url } : x)))}
              usage="thumb"
            />
            <button type="button" className="btn btn-secondary admin-btn-sm" onClick={() => setMembers((p) => p.filter((x) => x.id !== m.id))}>
              Remove
            </button>
          </div>
        ))}
        <CmsFormActions
          primaryLabel="Save team page"
          onPrimary={() => void savePartial({ ourTeamPageTitle, ourTeamPageLead, teamMembers: members })}
          saving={saving}
          secondary={
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                setMembers((p) => [
                  ...p,
                  { id: `tm-${Date.now()}`, name: "Name", role: "Role", description: "", image: "/academy-1.png" }
                ])
              }
            >
              Add member
            </button>
          }
        />
      </CmsSection>
    </section>
  );
}
