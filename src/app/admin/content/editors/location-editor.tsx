"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import type { CmsPitchLocation, SiteContent } from "@/lib/types";
import {
  CmsAlert,
  CmsEditorLoadFailed,
  CmsFormActions,
  CmsLoadingState,
  CmsPageHeader,
  CmsSection
} from "../_components/cms-shared";
import { useAdminSiteContent } from "../_lib/use-admin-site-content";

const AdminPitchMap = dynamic(
  () => import("@/components/locations/AdminPitchMap").then((m) => m.AdminPitchMap),
  { ssr: false, loading: () => <p className="muted">Loading map…</p> }
);

function newPitchId() {
  return `pitch-${Date.now()}`;
}

const DEFAULT_NEW: Omit<CmsPitchLocation, "id"> = {
  name: "New pitch",
  address: "",
  lat: -1.9441,
  lng: 30.0619,
  mapEmbedUrl: ""
};

export function LocationEditor() {
  const { data, loading, err, saving, savePartial, load } = useAdminSiteContent();
  const [locationPageTitle, setLocationPageTitle] = useState("");
  const [locationPageLead, setLocationPageLead] = useState("");
  const [pitches, setPitches] = useState<CmsPitchLocation[]>([]);

  const apply = useCallback((c: SiteContent) => {
    setLocationPageTitle(c.locationPageTitle);
    setLocationPageLead(c.locationPageLead);
    setPitches(
      c.pitchLocations.map((p) => ({
        ...p,
        address: p.address || p.line || "",
        lat: p.lat,
        lng: p.lng,
        mapEmbedUrl: p.mapEmbedUrl ?? ""
      }))
    );
  }, []);

  useEffect(() => {
    if (data) apply(data);
  }, [data, apply]);

  if (loading) return <CmsLoadingState />;

  if (!data) return <CmsEditorLoadFailed err={err} load={load} />;

  return (
    <section className="page-stack cms-editor-stack cms-editor-stack--cms">
      <CmsPageHeader
        title="Pitch locations"
        lead="Hero text, then pitches: each needs a name, written address, and map position. Maps use free OpenStreetMap (no API key); search uses Nominatim geocoding."
        previewHref="/locations"
      />
      {err ? (
        <CmsAlert variant="error" title="Could not save">
          {err}
        </CmsAlert>
      ) : null}
      <CmsSection title="Pitch locations page" description="Heading and intro shown on /locations.">
        <label className="form-label">
          <span>Page title</span>
          <input className="input-field" value={locationPageTitle} onChange={(e) => setLocationPageTitle(e.target.value)} />
        </label>
        <label className="form-label">
          <span>Page lead</span>
          <textarea className="input-field" rows={2} value={locationPageLead} onChange={(e) => setLocationPageLead(e.target.value)} />
        </label>
        <CmsFormActions
          primaryLabel="Save page header"
          onPrimary={() =>
            void savePartial({
              locationPageTitle,
              locationPageLead
            })
          }
          saving={saving}
        />
      </CmsSection>

      <CmsSection
        title="Pitches"
        description="Each pitch appears in the public list. Set the pin position via search, map click, or dragging."
      >
        {pitches.map((pitch, i) => (
          <div key={pitch.id} className="card" style={{ marginBottom: "1rem", padding: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <h3 className="page-section-title" style={{ margin: 0 }}>
                Pitch {i + 1}
              </h3>
              <button
                type="button"
                className="btn btn-secondary admin-btn-sm"
                onClick={() => setPitches((prev) => prev.filter((p) => p.id !== pitch.id))}
              >
                Remove pitch
              </button>
            </div>
            <label className="form-label">
              <span>Pitch name</span>
              <input
                className="input-field"
                value={pitch.name}
                onChange={(e) =>
                  setPitches((prev) => prev.map((p) => (p.id === pitch.id ? { ...p, name: e.target.value } : p)))
                }
              />
            </label>
            <label className="form-label">
              <span>Written address / location</span>
              <textarea
                className="input-field"
                rows={2}
                value={pitch.address}
                onChange={(e) =>
                  setPitches((prev) => prev.map((p) => (p.id === pitch.id ? { ...p, address: e.target.value } : p)))
                }
              />
            </label>
            <AdminPitchMap
              lat={pitch.lat}
              lng={pitch.lng}
              onChange={(lat, lng) =>
                setPitches((prev) => prev.map((p) => (p.id === pitch.id ? { ...p, lat, lng } : p)))
              }
            />
            <label className="form-label">
              <span>Optional: Google Maps embed URL (legacy)</span>
              <input
                className="input-field"
                value={pitch.mapEmbedUrl ?? ""}
                onChange={(e) =>
                  setPitches((prev) => prev.map((p) => (p.id === pitch.id ? { ...p, mapEmbedUrl: e.target.value } : p)))
                }
                placeholder="https://www.google.com/maps?..."
              />
            </label>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() =>
            setPitches((prev) => [...prev, { id: newPitchId(), ...DEFAULT_NEW }])
          }
        >
          Add pitch
        </button>
        <CmsFormActions
          primaryLabel="Save pitches"
          onPrimary={() =>
            void savePartial({
              pitchLocations: pitches,
              locationMapEmbedUrl: pitches[0]?.mapEmbedUrl ?? data.locationMapEmbedUrl,
              locationAddressLine: pitches[0]?.address ?? data.locationAddressLine
            })
          }
          saving={saving}
        />
      </CmsSection>
    </section>
  );
}
