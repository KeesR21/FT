"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  CmsAnnouncement,
  CmsContactInfo,
  CmsFooterContent,
  CmsPageSeo,
  CmsSponsor,
  CmsTestimonial,
  SiteContent
} from "@/lib/types";
import {
  CmsAlert,
  CmsDraftSwitch,
  CmsEditorLoadFailed,
  CmsFormActions,
  CmsLoadingState,
  CmsPageHeader,
  CmsSection,
  CmsStatusBadge
} from "../_components/cms-shared";
import { useAdminSiteContent } from "../_lib/use-admin-site-content";

function newId() {
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function SiteEditor() {
  const { data, loading, err, saving, savePartial, saveWithNotify, load } = useAdminSiteContent();
  const [footer, setFooter] = useState<CmsFooterContent | null>(null);
  const [contactInfo, setContactInfo] = useState<CmsContactInfo | null>(null);
  const [testimonials, setTestimonials] = useState<CmsTestimonial[]>([]);
  const [sponsors, setSponsors] = useState<CmsSponsor[]>([]);
  const [announcements, setAnnouncements] = useState<CmsAnnouncement[]>([]);
  const [pageSeo, setPageSeo] = useState<CmsPageSeo[]>([]);
  const [submissions, setSubmissions] = useState<
    Array<{ id: string; name: string; email: string; message: string; createdAt: string }>
  >([]);

  const apply = useCallback((c: SiteContent) => {
    setFooter(c.footerContent);
    setContactInfo(c.contactInfo);
    setTestimonials(c.testimonials ?? []);
    setSponsors(c.sponsors ?? []);
    setAnnouncements(c.announcements ?? []);
    setPageSeo(c.pageSeo ?? []);
  }, []);

  useEffect(() => {
    if (data) apply(data);
  }, [data, apply]);

  useEffect(() => {
    void fetch("/api/admin/contact-submissions")
      .then((r) => (r.ok ? r.json() : { submissions: [] }))
      .then((j) => setSubmissions(j.submissions ?? []))
      .catch(() => setSubmissions([]));
  }, []);

  if (loading) return <CmsLoadingState />;
  if (!data || !footer || !contactInfo) return <CmsEditorLoadFailed err={err} load={load} />;

  async function saveAll() {
    await saveWithNotify({
      footerContent: footer!,
      contactInfo: contactInfo!,
      testimonials,
      sponsors,
      announcements,
      pageSeo
    }, "Site settings saved.");
  }

  return (
    <section className="page-stack cms-editor-stack cms-editor-stack--cms">
      <CmsPageHeader
        title="Site settings"
        lead="Footer, contact details, testimonials, sponsors, announcements, and SEO — all stored in the database."
        previewHref="/"
      />
      {err ? (
        <CmsAlert variant="error" title="Could not save">
          {err}
        </CmsAlert>
      ) : null}

      <CmsSection title="Footer" description="Shown on every public page.">
        <label className="form-label">
          <span>Brand title</span>
          <input className="input-field" value={footer.brandTitle} onChange={(e) => setFooter({ ...footer, brandTitle: e.target.value })} />
        </label>
        <label className="form-label">
          <span>Tagline</span>
          <textarea className="input-field" rows={2} value={footer.tagline} onChange={(e) => setFooter({ ...footer, tagline: e.target.value })} />
        </label>
        <label className="form-label">
          <span>Copyright line</span>
          <input className="input-field" value={footer.copyrightText} onChange={(e) => setFooter({ ...footer, copyrightText: e.target.value })} />
        </label>
        <label className="form-label">
          <span>Motto</span>
          <input className="input-field" value={footer.motto} onChange={(e) => setFooter({ ...footer, motto: e.target.value })} />
        </label>
      </CmsSection>

      <CmsSection title="Contact information" description="Phone, email, offices, and social links.">
        <p className="cms-field-group-label">Phone numbers</p>
        {contactInfo.phones.map((p, i) => (
          <div key={p.id} className="cms-inline-row">
            <input className="input-field" placeholder="Label e.g. Main office" value={p.label} onChange={(e) => {
              const phones = [...contactInfo.phones];
              phones[i] = { ...p, label: e.target.value };
              setContactInfo({ ...contactInfo, phones });
            }} />
            <input className="input-field" placeholder="Number" value={p.number} onChange={(e) => {
              const phones = [...contactInfo.phones];
              phones[i] = { ...p, number: e.target.value };
              setContactInfo({ ...contactInfo, phones });
            }} />
            <button type="button" className="btn btn--ghost btn--icon" title="Remove" onClick={() => setContactInfo({ ...contactInfo, phones: contactInfo.phones.filter((_, j) => j !== i) })}>✕</button>
          </div>
        ))}
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setContactInfo({ ...contactInfo, phones: [...contactInfo.phones, { id: newId(), label: "", number: "" }] })}>+ Add phone</button>

        <p className="cms-field-group-label" style={{ marginTop: "1rem" }}>Email addresses</p>
        {contactInfo.emails.map((em, i) => (
          <div key={em.id} className="cms-inline-row">
            <input className="input-field" placeholder="Label e.g. General enquiries" value={em.label} onChange={(e) => {
              const emails = [...contactInfo.emails];
              emails[i] = { ...em, label: e.target.value };
              setContactInfo({ ...contactInfo, emails });
            }} />
            <input className="input-field" placeholder="Email address" value={em.address} onChange={(e) => {
              const emails = [...contactInfo.emails];
              emails[i] = { ...em, address: e.target.value };
              setContactInfo({ ...contactInfo, emails });
            }} />
            <button type="button" className="btn btn--ghost btn--icon" title="Remove" onClick={() => setContactInfo({ ...contactInfo, emails: contactInfo.emails.filter((_, j) => j !== i) })}>✕</button>
          </div>
        ))}
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setContactInfo({ ...contactInfo, emails: [...contactInfo.emails, { id: newId(), label: "", address: "" }] })}>+ Add email</button>

        <p className="cms-field-group-label" style={{ marginTop: "1rem" }}>Social media profiles</p>
        <p className="muted" style={{ fontSize: "0.82rem", marginBottom: "0.5rem" }}>
          These links appear in the footer. Platform name controls the icon shown (e.g. <em>Facebook</em>, <em>Instagram</em>, <em>YouTube</em>, <em>TikTok</em>, <em>WhatsApp</em>).
        </p>
        {(contactInfo.socialLinks ?? []).map((s, i) => (
          <div key={s.id} className="cms-inline-row">
            <input className="input-field" placeholder="Platform (e.g. Facebook)" value={s.platform} onChange={(e) => {
              const socialLinks = [...(contactInfo.socialLinks ?? [])];
              socialLinks[i] = { ...s, platform: e.target.value };
              setContactInfo({ ...contactInfo, socialLinks });
            }} />
            <input className="input-field" placeholder="Full URL (https://...)" value={s.url} onChange={(e) => {
              const socialLinks = [...(contactInfo.socialLinks ?? [])];
              socialLinks[i] = { ...s, url: e.target.value };
              setContactInfo({ ...contactInfo, socialLinks });
            }} />
            <button type="button" className="btn btn--ghost btn--icon" title="Remove" onClick={() => setContactInfo({ ...contactInfo, socialLinks: (contactInfo.socialLinks ?? []).filter((_, j) => j !== i) })}>✕</button>
          </div>
        ))}
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setContactInfo({ ...contactInfo, socialLinks: [...(contactInfo.socialLinks ?? []), { id: newId(), platform: "Facebook", url: "" }] })}>+ Add social link</button>
      </CmsSection>

      <CmsSection title="Testimonials" description="Parent, player, and partner quotes.">
        {testimonials.map((t, i) => (
          <article key={t.id} className="cms-repeat-card">
            <CmsStatusBadge status={t.status ?? "published"} />
            <textarea className="input-field" rows={2} value={t.quote} onChange={(e) => {
              const next = [...testimonials];
              next[i] = { ...t, quote: e.target.value };
              setTestimonials(next);
            }} />
            <CmsDraftSwitch
              value={t.status === "draft" ? "draft" : "published"}
              onChange={(status) => {
                const next = [...testimonials];
                next[i] = { ...t, status };
                setTestimonials(next);
              }}
            />
          </article>
        ))}
        <button type="button" className="btn btn--ghost" onClick={() => setTestimonials([...testimonials, { id: newId(), type: "parent", quote: "", name: "", role: "", status: "draft" }])}>
          Add testimonial
        </button>
      </CmsSection>

      <CmsSection title="Announcements" description="Site-wide notices (registration, alerts).">
        {announcements.map((a, i) => (
          <article key={a.id} className="cms-repeat-card">
            <input className="input-field" value={a.title} onChange={(e) => {
              const next = [...announcements];
              next[i] = { ...a, title: e.target.value };
              setAnnouncements(next);
            }} />
            <textarea className="input-field" rows={2} value={a.body} onChange={(e) => {
              const next = [...announcements];
              next[i] = { ...a, body: e.target.value };
              setAnnouncements(next);
            }} />
          </article>
        ))}
        <button type="button" className="btn btn--ghost" onClick={() => setAnnouncements([...announcements, { id: newId(), title: "", body: "", status: "draft" }])}>
          Add announcement
        </button>
      </CmsSection>

      <CmsSection title="SEO per page" description="Titles, descriptions, and hero images for public routes.">
        {pageSeo.map((row, i) => (
          <article key={row.slug} className="cms-repeat-card">
            <strong>{row.slug}</strong>
            <input className="input-field" placeholder="Meta title" value={row.title} onChange={(e) => {
              const next = [...pageSeo];
              next[i] = { ...row, title: e.target.value };
              setPageSeo(next);
            }} />
            <textarea className="input-field" rows={2} placeholder="Meta description" value={row.metaDescription} onChange={(e) => {
              const next = [...pageSeo];
              next[i] = { ...row, metaDescription: e.target.value };
              setPageSeo(next);
            }} />
            <input className="input-field" placeholder="Hero image path" value={row.heroImage ?? ""} onChange={(e) => {
              const next = [...pageSeo];
              next[i] = { ...row, heroImage: e.target.value };
              setPageSeo(next);
            }} />
          </article>
        ))}
      </CmsSection>

      <CmsSection title="Contact form submissions" description="Stored in MongoDB when connected.">
        {submissions.length === 0 ? (
          <p className="muted">No submissions yet.</p>
        ) : (
          <ul className="cms-submission-list">
            {submissions.slice(0, 20).map((s) => (
              <li key={s.id}>
                <strong>{s.name}</strong> — {s.email}
                <p className="muted">{s.message.slice(0, 120)}…</p>
              </li>
            ))}
          </ul>
        )}
      </CmsSection>

      <CmsFormActions primaryLabel="Save site settings" onPrimary={() => void saveAll()} saving={saving} />
    </section>
  );
}
