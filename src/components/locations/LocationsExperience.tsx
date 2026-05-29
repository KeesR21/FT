"use client";

import type { CmsPitchLocation } from "@/lib/types";
import clsx from "clsx";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";

const PitchesMap = dynamic(() => import("./PitchesMap").then((m) => m.PitchesMap), {
  ssr: false,
  loading: () => <div className="locations-map locations-map--skeleton muted">Loading map…</div>
});

type Props = {
  pitches: CmsPitchLocation[];
};

export function LocationsExperience({ pitches }: Props) {
  const [selectedId, setSelectedId] = useState(pitches[0]?.id ?? "");
  const selected = useMemo(() => pitches.find((p) => p.id === selectedId), [pitches, selectedId]);

  useEffect(() => {
    if (pitches.length === 0) return;
    if (!pitches.some((p) => p.id === selectedId)) {
      setSelectedId(pitches[0]!.id);
    }
  }, [pitches, selectedId]);

  const onSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  if (pitches.length === 0) {
    return <p className="muted card locations-page-empty">No pitches published yet.</p>;
  }

  return (
    <div className="locations-xp">
      <nav className="locations-xp__nav card" aria-label="Pitch list">
        <p className="locations-xp__nav-label">Pitches</p>
        <ul className="locations-xp__list">
          {pitches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className={clsx("locations-xp__item", p.id === selectedId && "locations-xp__item--active")}
                onClick={() => onSelect(p.id)}
                aria-pressed={p.id === selectedId}
              >
                <span className="locations-xp__item-text">{p.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="locations-xp__main">
        <section className="locations-detail card" aria-live="polite" aria-atomic="true">
          {selected ? (
            <div key={selected.id} className="locations-detail__inner locations-detail__inner--animate">
              <div className="locations-detail__header">
                <span className="locations-detail__badge">Selected pitch</span>
                <h2 className="locations-detail__title">{selected.name}</h2>
                <p className="locations-detail__address muted">
                  <svg className="locations-detail__addr-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden width="14" height="14">
                    <path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 0 0 .281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 1 0 3 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 0 0 2.273 1.765 11.842 11.842 0 0 0 .988.559l.018.008.006.003ZM10 11.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z" clipRule="evenodd" />
                  </svg>
                  {selected.address}
                </p>
                {"lat" in selected && "lng" in selected && (selected as { lat?: number }).lat && (selected as { lng?: number }).lng ? (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${(selected as { lat: number }).lat},${(selected as { lng: number }).lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary locations-detail__directions-btn"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <polygon points="3 11 22 2 13 21 11 13 3 11" />
                    </svg>
                    Get directions
                  </a>
                ) : (
                  <a
                    href={`https://www.google.com/maps/search/${encodeURIComponent(selected.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary locations-detail__directions-btn"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <polygon points="3 11 22 2 13 21 11 13 3 11" />
                    </svg>
                    Get directions
                  </a>
                )}
              </div>
            </div>
          ) : null}
        </section>

        <section className="locations-map-section card" aria-label="Map of all pitches">
          <p className="locations-map-section__label">All pitches on the map</p>
          <p className="locations-map-section__hint muted">
            OpenStreetMap (free, no API key). Click a pin or use the list to zoom and highlight a site.
          </p>
          <PitchesMap pitches={pitches} selectedId={selectedId} onSelectPitch={onSelect} />
        </section>
      </div>
    </div>
  );
}
