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
                <p className="events-page-card__meta">Selected pitch</p>
                <h2 className="locations-detail__title">{selected.name}</h2>
                <p className="locations-detail__address muted">{selected.address}</p>
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
