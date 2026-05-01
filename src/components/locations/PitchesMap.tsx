"use client";

import type { CmsPitchLocation } from "@/lib/types";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

function pitchMarkerIcon(selected: boolean) {
  return L.divIcon({
    className: "loc-leaflet-marker-wrap",
    html: `<div class="loc-marker ${selected ? "loc-marker--selected" : ""}" role="presentation"></div>`,
    iconSize: [34, 40],
    iconAnchor: [17, 38]
  });
}

function MapViewController({
  pitches,
  selectedId
}: {
  pitches: CmsPitchLocation[];
  selectedId: string;
}) {
  const map = useMap();
  const initial = useRef(true);

  useEffect(() => {
    if (pitches.length === 0) return;
    if (initial.current) {
      const bounds = L.latLngBounds(pitches.map((p) => [p.lat, p.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [44, 44], maxZoom: 13 });
      initial.current = false;
      return;
    }
    const p = pitches.find((x) => x.id === selectedId);
    if (p) {
      map.flyTo([p.lat, p.lng], 15, { duration: 0.75 });
    }
  }, [map, pitches, selectedId]);

  return null;
}

export function PitchesMap({
  pitches,
  selectedId,
  onSelectPitch
}: {
  pitches: CmsPitchLocation[];
  selectedId: string;
  onSelectPitch: (id: string) => void;
}) {
  const center = pitches[0] ? ([pitches[0].lat, pitches[0].lng] as [number, number]) : ([-1.94, 30.06] as [number, number]);

  if (pitches.length === 0) {
    return <div className="locations-map locations-map--empty muted">No map data.</div>;
  }

  const mapKey = pitches.map((p) => p.id).join("|");

  return (
    <MapContainer
      key={mapKey}
      center={center}
      zoom={12}
      className="locations-map"
      scrollWheelZoom
      aria-label="Pitch locations map (OpenStreetMap — free, no API key)"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapViewController pitches={pitches} selectedId={selectedId} />
      {pitches.map((p) => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          icon={pitchMarkerIcon(p.id === selectedId)}
          eventHandlers={{
            click: () => onSelectPitch(p.id)
          }}
        />
      ))}
    </MapContainer>
  );
}
