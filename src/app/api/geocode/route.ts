import { NextResponse } from "next/server";

type NominatimHit = { lat: string; lon: string; display_name: string };

/**
 * Free geocoding via OpenStreetMap Nominatim (no API key).
 * Use sparingly; see https://operations.osmfoundation.org/policies/nominatim/
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ error: "Query too short" }, { status: 400 });
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "6");

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "FTPRLionsAcademySite/1.0 (academy website; contact via site admin)"
      },
      next: { revalidate: 0 }
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Geocoder unavailable" }, { status: 502 });
    }
    const data = (await res.json()) as NominatimHit[];
    const results = data.map((r) => ({
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      label: r.display_name
    }));
    return NextResponse.json({ results, provider: "nominatim" });
  } catch {
    return NextResponse.json({ error: "Geocoder failed" }, { status: 502 });
  }
}
