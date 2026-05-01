import { buildDefaultSiteContent } from "@/lib/default-site-content";
import type { CmsPitchLocation, SiteContent } from "@/lib/types";

/** Kigali area — spread pins when coordinates missing */
function fallbackCoord(index: number): { lat: number; lng: number } {
  const baseLat = -1.9441;
  const baseLng = 30.0619;
  const col = index % 4;
  const row = Math.floor(index / 4);
  return {
    lat: baseLat + row * 0.028 - col * 0.006,
    lng: baseLng + col * 0.022 + row * 0.012
  };
}

function normalizePitchList(list: CmsPitchLocation[]): CmsPitchLocation[] {
  return list.map((p, i) => {
    const address = (p.address ?? p.line ?? "").trim();
    let lat = typeof p.lat === "number" && Number.isFinite(p.lat) ? p.lat : NaN;
    let lng = typeof p.lng === "number" && Number.isFinite(p.lng) ? p.lng : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      const fb = fallbackCoord(i);
      lat = fb.lat;
      lng = fb.lng;
    }
    return {
      id: p.id,
      name: (p.name || "Pitch").trim(),
      address: address || "Address to be confirmed",
      line: address,
      lat,
      lng,
      mapEmbedUrl: (p.mapEmbedUrl ?? "").trim() || undefined
    };
  });
}

/** Ensure `pitchLocations` is populated and shaped for /locations. */
export function withNormalizedPitchLocations(site: SiteContent): SiteContent {
  const base = buildDefaultSiteContent();
  if (site.pitchLocations && site.pitchLocations.length > 0) {
    return { ...site, pitchLocations: normalizePitchList(site.pitchLocations as CmsPitchLocation[]) };
  }
  if (site.locationMapEmbedUrl?.trim()) {
    const line = site.locationAddressLine?.trim() || "";
    return {
      ...site,
      pitchLocations: normalizePitchList([
        {
          id: "pitch-legacy",
          name: "Main training site",
          address: line || "Training site",
          line,
          lat: fallbackCoord(0).lat,
          lng: fallbackCoord(0).lng,
          mapEmbedUrl: site.locationMapEmbedUrl.trim()
        }
      ])
    };
  }
  return { ...site, pitchLocations: normalizePitchList(base.pitchLocations) };
}
