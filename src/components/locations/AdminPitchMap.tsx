"use client";

import L from "leaflet";
import { useCallback, useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

function adminIcon() {
  return L.divIcon({
    className: "loc-leaflet-marker-wrap",
    html: `<div class="loc-marker loc-marker--admin" role="presentation"></div>`,
    iconSize: [34, 40],
    iconAnchor: [17, 38]
  });
}

function MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    map.setView([lat, lng], map.getZoom(), { animate: true });
  }, [lat, lng, map]);
  return null;
}

type GeocodeHit = { lat: number; lng: number; label: string };

export function AdminPitchMap({
  lat,
  lng,
  onChange
}: {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
}) {
  const [search, setSearch] = useState("");
  const [hits, setHits] = useState<GeocodeHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);

  const runSearch = useCallback(async () => {
    const q = search.trim();
    if (q.length < 2) return;
    setSearching(true);
    setSearchErr(null);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as { results?: GeocodeHit[]; error?: string };
      if (!res.ok) {
        setSearchErr(data.error ?? "Search failed");
        setHits([]);
        return;
      }
      setHits(data.results ?? []);
    } catch {
      setSearchErr("Search failed");
      setHits([]);
    } finally {
      setSearching(false);
    }
  }, [search]);

  const applyHit = useCallback(
    (h: GeocodeHit) => {
      onChange(h.lat, h.lng);
      setHits([]);
      setSearch("");
    },
    [onChange]
  );

  return (
    <div className="admin-pitch-map">
      <div className="admin-pitch-map__search">
        <label className="form-label">
          <span>Search place (sets pin)</span>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            <input
              className="input-field"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void runSearch())}
              placeholder="e.g. Kigali Stadium"
            />
            <button type="button" className="btn btn-secondary admin-btn-sm" disabled={searching} onClick={() => void runSearch()}>
              {searching ? "…" : "Search"}
            </button>
          </div>
        </label>
        {searchErr ? <p className="muted" style={{ fontSize: "0.85rem", marginTop: "0.35rem" }}>{searchErr}</p> : null}
        {hits.length > 0 ? (
          <ul className="admin-pitch-map__hits">
            {hits.map((h, i) => (
              <li key={`${h.lat}-${h.lng}-${i}`}>
                <button type="button" className="admin-pitch-map__hit" onClick={() => applyHit(h)}>
                  {h.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <p className="muted" style={{ fontSize: "0.85rem", margin: "0.5rem 0" }}>
        Map uses free OpenStreetMap tiles (no API key). Click the map to place the pin, or drag it. Coordinates save with the pitch.
      </p>
      <MapContainer center={[lat, lng]} zoom={14} className="admin-pitch-map__leaflet" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Recenter lat={lat} lng={lng} />
        <MapClickHandler onPick={onChange} />
        <Marker
          position={[lat, lng]}
          icon={adminIcon()}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const pos = e.target.getLatLng();
              onChange(pos.lat, pos.lng);
            }
          }}
        />
      </MapContainer>
      <div className="admin-pitch-map__coords">
        <label className="form-label">
          <span>Latitude</span>
          <input
            className="input-field"
            type="number"
            step="any"
            value={Number.isFinite(lat) ? lat : ""}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0, lng)}
          />
        </label>
        <label className="form-label">
          <span>Longitude</span>
          <input
            className="input-field"
            type="number"
            step="any"
            value={Number.isFinite(lng) ? lng : ""}
            onChange={(e) => onChange(lat, parseFloat(e.target.value) || 0)}
          />
        </label>
      </div>
    </div>
  );
}
