import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Address search, returning candidates rather than a guess.
 *
 * "175 5th Ave" matches a building in Manhattan and another in San Francisco,
 * three thousand miles and a climate apart. Silently taking the first result
 * would bind the segment to the wrong city and every number afterwards would be
 * confidently wrong, so the choice belongs to the person who knows the building.
 */

export interface Candidate {
  /** One clean line: street, city, state, postcode. */
  label: string;
  /** What OpenStreetMap thinks it is: house, office, attraction. */
  kind: string;
  lat: number;
  lon: number;
}

interface Hit {
  lat: string; lon: string; display_name: string; type?: string; class?: string;
  address?: Record<string, string>;
}

const format = (h: Hit): string => {
  const a = h.address ?? {};
  const parts = [
    [a['house_number'], a['road']].filter(Boolean).join(' '),
    a['city'] ?? a['town'] ?? a['village'] ?? a['suburb'] ?? a['county'],
    a['state'],
    a['postcode'],
  ].filter(Boolean);
  return parts.length >= 2 ? parts.join(', ') : h.display_name;
};

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < 3) return NextResponse.json({ candidates: [] });

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '8');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('countrycodes', 'us');   // FortyGuard coverage is US only

  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'envelope-copilot/0.1' },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return NextResponse.json({ candidates: [], error: 'Address search is unavailable.' });
    const hits = (await r.json()) as Hit[];

    // One building often appears several times: as a house, a shop, an
    // attraction. Same rooftop, same tile, so collapse them.
    const seen = new Set<string>();
    const candidates: Candidate[] = [];
    for (const h of hits) {
      const lat = Number(h.lat), lon = Number(h.lon);
      const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({ label: format(h), kind: h.type ?? h.class ?? 'place', lat, lon });
      if (candidates.length === 5) break;
    }
    return NextResponse.json({ candidates });
  } catch {
    return NextResponse.json({ candidates: [], error: 'Address search timed out.' });
  }
}
