"use client";

import { useCallback, useEffect, useState } from "react";
import type { SiteContent } from "@/lib/types";
import {
  CmsConfirmDialog,
  CmsEditorLoadFailed,
  CmsFormActions,
  CmsImageField,
  CmsLoadingState,
  CmsPageHeader,
  CmsSaveBar,
  CmsSection,
  CmsSubcard
} from "../_components/cms-shared";
import { useAdminSiteContent } from "../_lib/use-admin-site-content";

type MemberErrors = { name?: string; role?: string };

function validateMember(m: SiteContent["teamMembers"][number]): MemberErrors {
  const errs: MemberErrors = {};
  if (!m.name.trim()) errs.name = "Name is required.";
  if (!m.role.trim()) errs.role = "Role is required.";
  return errs;
}

export function TeamEditor() {
  const { data, loading, err, saving, saveWithNotify, load } = useAdminSiteContent();
  const [ourTeamPageTitle, setOurTeamPageTitle] = useState("");
  const [ourTeamPageLead, setOurTeamPageLead] = useState("");
  const [members, setMembers] = useState<SiteContent["teamMembers"]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, MemberErrors>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const apply = useCallback((c: SiteContent) => {
    setOurTeamPageTitle(c.ourTeamPageTitle);
    setOurTeamPageLead(c.ourTeamPageLead);
    setMembers(c.teamMembers.map((m) => ({ ...m })));
  }, []);

  useEffect(() => {
    if (data) apply(data);
  }, [data, apply]);

  function updateMember(id: string, patch: Partial<SiteContent["teamMembers"][number]>) {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    setFieldErrors((prev) => ({ ...prev, [id]: {} }));
  }

  function validateAll(): boolean {
    const allErrors: Record<string, MemberErrors> = {};
    let valid = true;
    for (const m of members) {
      const errs = validateMember(m);
      allErrors[m.id] = errs;
      if (Object.keys(errs).length > 0) valid = false;
    }
    setFieldErrors(allErrors);
    return valid;
  }

  async function handleSave() {
    if (!validateAll()) return;
    await saveWithNotify(
      { ourTeamPageTitle, ourTeamPageLead, teamMembers: members },
      "Team page saved successfully."
    );
  }

  const confirmTarget = confirmDeleteId ? members.find((m) => m.id === confirmDeleteId) : null;

  if (loading) return <CmsLoadingState message="Loading team editor…" />;
  if (!data) return <CmsEditorLoadFailed err={err} load={load} />;

  return (
    <>
      <CmsConfirmDialog
        open={!!confirmDeleteId}
        title="Remove team member?"
        message={confirmTarget ? <>Remove <strong>{confirmTarget.name || "this member"}</strong> from the team? This cannot be undone.</> : "Remove this member?"}
        confirmLabel="Remove member"
        onConfirm={() => {
          if (confirmDeleteId) {
            setMembers((p) => p.filter((m) => m.id !== confirmDeleteId));
            setFieldErrors((prev) => { const next = { ...prev }; delete next[confirmDeleteId]; return next; });
          }
          setConfirmDeleteId(null);
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />

      <section className="page-stack cms-editor-stack cms-editor-stack--cms">
        <CmsPageHeader
          title="Our Team"
          lead="Page header and coaching staff cards on /our-team."
          previewHref="/our-team"
        />

        {/* Page copy */}
        <CmsSection id="cms-team-page-copy" title="Page header" description="Title and lead shown at the top of /our-team.">
          <label className="form-label">
            <span>Page title</span>
            <input className="input-field" value={ourTeamPageTitle} onChange={(e) => setOurTeamPageTitle(e.target.value)} />
          </label>
          <label className="form-label">
            <span>Page lead</span>
            <textarea className="input-field" rows={2} value={ourTeamPageLead} onChange={(e) => setOurTeamPageLead(e.target.value)} />
          </label>
        </CmsSection>

        {/* Team members */}
        <CmsSection
          id="cms-team-members"
          title={`Team members (${members.length})`}
          description="Each member is displayed as a card on /our-team. Coaches added here are also available for selection in the timetable."
        >
          {members.length === 0 && (
            <p className="muted cms-events-empty">No team members added yet.</p>
          )}

          <div className="cms-team-list">
            {members.map((m, idx) => {
              const errs = fieldErrors[m.id] ?? {};
              return (
                <CmsSubcard key={m.id}>
                  <div className="cms-team-card__header">
                    <span className="cms-team-card__index muted">Member {idx + 1}</span>
                    <span className="cms-team-card__name-preview">{m.name || <em className="muted">Unnamed</em>}</span>
                    {m.role && <span className="cms-team-card__role-preview muted">{m.role}</span>}
                    <button
                      type="button"
                      className="cms-event-card__delete-btn"
                      onClick={() => setConfirmDeleteId(m.id)}
                      title="Remove member"
                      aria-label={`Remove ${m.name || "this member"}`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      </svg>
                    </button>
                  </div>

                  <div className="cms-team-card__fields">
                    <div className="cms-team-card__fields-row">
                      <div className="cms-event-card__field">
                        <label className="form-label" htmlFor={`tm-name-${m.id}`}>
                          <span>Full name <span className="cms-event-card__required">*</span></span>
                        </label>
                        <input
                          id={`tm-name-${m.id}`}
                          className={`input-field${errs.name ? " input-field--error" : ""}`}
                          value={m.name}
                          placeholder="e.g. Jean-Paul Hakizimana"
                          onChange={(e) => updateMember(m.id, { name: e.target.value })}
                        />
                        {errs.name && <span className="cms-field-error">{errs.name}</span>}
                      </div>
                      <div className="cms-event-card__field">
                        <label className="form-label" htmlFor={`tm-role-${m.id}`}>
                          <span>Role / title <span className="cms-event-card__required">*</span></span>
                        </label>
                        <input
                          id={`tm-role-${m.id}`}
                          className={`input-field${errs.role ? " input-field--error" : ""}`}
                          value={m.role}
                          placeholder="e.g. Head Coach"
                          onChange={(e) => updateMember(m.id, { role: e.target.value })}
                        />
                        {errs.role && <span className="cms-field-error">{errs.role}</span>}
                      </div>
                    </div>

                    <label className="form-label">
                      <span>Bio / description <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></span>
                      <textarea
                        className="input-field"
                        rows={2}
                        value={m.description}
                        placeholder="Brief biography or specialties…"
                        onChange={(e) => updateMember(m.id, { description: e.target.value })}
                      />
                    </label>

                    <CmsImageField
                      label="Profile photo"
                      value={m.image}
                      onChange={(url) => updateMember(m.id, { image: url })}
                      usage="thumb"
                    />
                  </div>
                </CmsSubcard>
              );
            })}
          </div>

          <div className="cms-events-add-row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                setMembers((p) => [
                  ...p,
                  { id: `tm-${Date.now()}`, name: "", role: "", description: "", image: "/academy-1.png" }
                ])
              }
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add member
            </button>
          </div>

          <CmsSaveBar
            saving={saving}
            error={err || undefined}
            onSave={handleSave}
            saveLabel="Save team"
            successMsg="Team saved successfully."
          />
        </CmsSection>
      </section>
    </>
  );
}
