"use client";

import { useCallback, useEffect, useState } from "react";
import type { SiteContent } from "@/lib/types";
import {
  CmsAlert,
  CmsEditorLoadFailed,
  CmsFormActions,
  CmsLoadingState,
  CmsPageHeader,
  CmsSection
} from "../_components/cms-shared";
import { useAdminSiteContent } from "../_lib/use-admin-site-content";

export function ContactEditor() {
  const { data, loading, err, saving, savePartial, load } = useAdminSiteContent();
  const [contactPageLead, setContactPageLead] = useState("");
  const [contactBlurb, setContactBlurb] = useState("");
  const [contactOfficeHours, setContactOfficeHours] = useState("");

  const apply = useCallback((c: SiteContent) => {
    setContactPageLead(c.contactPageLead);
    setContactBlurb(c.contactBlurb);
    setContactOfficeHours(c.contactOfficeHours);
  }, []);

  useEffect(() => {
    if (data) apply(data);
  }, [data, apply]);

  if (loading) return <CmsLoadingState />;

  if (!data) return <CmsEditorLoadFailed err={err} load={load} />;

  return (
    <section className="page-stack cms-editor-stack cms-editor-stack--cms">
      <CmsPageHeader title="Contact" lead="Hero, details block, and office hours." previewHref="/contact" />
      {err ? (
        <CmsAlert variant="error" title="Could not save">
          {err}
        </CmsAlert>
      ) : null}
      <CmsSection title="Page copy" description="Shown above and beside the contact form on the public page.">
        <label className="form-label">
          <span>Hero lead</span>
          <textarea className="input-field" rows={2} value={contactPageLead} onChange={(e) => setContactPageLead(e.target.value)} />
        </label>
        <label className="form-label">
          <span>Contact details block</span>
          <textarea className="input-field" rows={5} value={contactBlurb} onChange={(e) => setContactBlurb(e.target.value)} />
        </label>
        <label className="form-label">
          <span>Office hours line</span>
          <input className="input-field" value={contactOfficeHours} onChange={(e) => setContactOfficeHours(e.target.value)} />
        </label>
        <p className="muted admin-cell-muted">The contact form is static UI; hook to email/API separately if needed.</p>
        <CmsFormActions primaryLabel="Save contact page" onPrimary={() => void savePartial({ contactPageLead, contactBlurb, contactOfficeHours })} saving={saving} />
      </CmsSection>
    </section>
  );
}
