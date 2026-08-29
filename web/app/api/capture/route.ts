import { NextResponse } from 'next/server';
import { EnvSnapshot, type Building } from 'core/contracts';
import { FortyGuardClient, boxAround, tileGrid, tileTemperatureAt } from 'core/weather/fortyguard';
import { normalizeEnvParams } from 'core/weather/normalize';
import { buildArtifact } from 'core/copilot/artifact';
import { demoBuilding } from 'core/building';
import { log } from 'core/observability';
import { usTimezone } from '@/lib/us-timezone';
import { createJob, failJob, getGeometry, getJob, patchJob, setGeometry } from '@/lib/capture-store';
import { getCurrentAccount, type CurrentAccount } from '@/lib/session';
import { saveBuilding, saveRun, getBuilding, getLatestRun } from '@/lib/buildings-store';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Live capture for one address.
 *
 * This is what makes the product a product: the answer depends on where the
 * building is. `/replay` stays frozen on a committed fixture — that is the
 * reproducible proof artifact and determinism.md still governs it. This route is
 * the opposite, and must hit the real API, because "an address is enough" is the
 * entire Phase 1 claim in docs/flows/product-flow.md.
 */

interface GeocodeHit { lat: string; lon: string; display_name: string }

async function geocode(address: string) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', address);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'us');   // FortyGuard coverage is US only
  const r = await fetch(url, { headers: { 'User-Agent': 'envo/0.1' } });
  if (!r.ok) throw new Error('The address lookup service did not respond.');
  const hit = ((await r.json()) as GeocodeHit[])[0];
  if (!hit) throw new Error('That address could not be found in the United States.');
  return { lat: Number(hit.lat), lon: Number(hit.lon), label: hit.display_name };
}

export async function POST(request: Request) {
  const { address, floorAreaM2, lat, lon } = (await request.json()) as {
    address?: string; floorAreaM2?: number; lat?: number; lon?: number;
  };
  if (!address || address.trim().length < 5) {
    return NextResponse.json({ error: 'Choose an address.' }, { status: 400 });
  }
  if (!process.env['FORTYGUARD_API_KEY']) {
    return NextResponse.json({ error: 'FORTYGUARD_API_KEY is not configured on the server.' }, { status: 500 });
  }
  const account = await getCurrentAccount();
  if (!account) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  if (account.role === 'viewer') {
    return NextResponse.json({ error: 'Viewers can look, not capture. Ask an owner or operator.' }, { status: 403 });
  }

  const job = createJob(address.trim());
  const chosen = Number.isFinite(lat) && Number.isFinite(lon)
    ? { lat: lat as number, lon: lon as number, label: address.trim() }
    : undefined;
  void run(
    job.id, address.trim(),
    Number(floorAreaM2) > 0 ? Number(floorAreaM2) : demoBuilding.floorAreaM2,
    chosen, account,
  );
  return NextResponse.json({ id: job.id, stage: job.stage });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = params.get('id');
  if (params.get('geometry')) {
    const g = id ? getGeometry(id) : undefined;
    if (!g) return NextResponse.json({ error: 'No geometry for that capture.' }, { status: 404 });
    return NextResponse.json(g);
  }
  const job = id ? getJob(id) : undefined;
  if (job) return NextResponse.json(job);

  if (id) {
    const account = await getCurrentAccount();
    const saved = await getBuilding(id);
    // Scoped to the caller's own org — a guessed or shared id from another
    // org must not leak that building's data.
    if (saved && account && saved.orgId === account.orgId) {
      const savedRun = await getLatestRun(saved.id);
      if (savedRun) {
        return NextResponse.json({
          id: saved.id, stage: 'done', address: saved.address,
          artifact: savedRun.artifact, assumptions: savedRun.assumptions,
        });
      }
    }
  }
  return NextResponse.json({ error: 'This capture has expired. Run a new one.' }, { status: 404 });
}

/**
 * An address tells us where a building is, never what it is made of. Glazed area
 * scales with floor area off the demo envelope and every other envelope property
 * is carried over unchanged. These are shown to the user rather than absorbed
 * silently, per docs/decisions/product/honesty-rails.md.
 */
function buildingFor(name: string, lat: number, lon: number, floorAreaM2: number): {
  building: Building; assumptions: string[];
} {
  const scale = floorAreaM2 / demoBuilding.floorAreaM2;
  return {
    building: {
      ...demoBuilding,
      id: `live-${lat.toFixed(4)}-${lon.toFixed(4)}`,
      name, lat, lon,
      segmentId: `seg_${lat.toFixed(4)}_${lon.toFixed(4)}`,
      floorAreaM2,
      facades: demoBuilding.facades.map((f) => ({ ...f, glazedAreaM2: Math.round(f.glazedAreaM2 * scale) })),
    },
    assumptions: [
      `Glazed area scaled to ${floorAreaM2.toLocaleString()} m² floor area. We cannot read glazing from an address.`,
      `Thermal mass assumed at ${demoBuilding.thermalMassHours} h and east, south and west facades assumed tintable.`,
      `Setpoint assumed ${demoBuilding.nominalSetpointF} °F. Correct these and the plan changes.`,
    ],
  };
}

async function run(
  id: string, address: string, floorAreaM2: number,
  /** Already picked from the candidate list, so it is not guessed a second time. */
  chosen: { lat: number; lon: number; label: string } | undefined,
  account: CurrentAccount,
) {
  try {
    const { lat, lon, label } = chosen ?? await geocode(address);
    const timezone = usTimezone(lat, lon);

    // Must sit inside FortyGuard's window: 2019-01-01 through now + 12 hours.
    const date = new Date().toISOString().slice(0, 10);
    const dateTime = { start_date: date, start_time: '06:00', end_time: '22:00', filter_type: 2 as const };
    const client = new FortyGuardClient({ apiKey: process.env['FORTYGUARD_API_KEY']! });

    patchJob(id, { stage: 'heatmap' });
    const heat = (await client.heatmap(boxAround(lat, lon, 0.012), dateTime, 100)) as {
      map_data: Parameters<typeof tileGrid>[0];
      stats_data?: unknown;
    };

    patchJob(id, { stage: 'reading-tile' });
    const tileTemperatureC = tileTemperatureAt(heat.map_data, lat, lon);
    const layout = tileGrid(heat.map_data, lat, lon, heat);

    // Six decimals is about 0.1 m, well past what a 100 m tile needs, and keeps
    // the geometry payload to a few hundred kilobytes.
    const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
    setGeometry(id, {
      minC: layout.minC, maxC: layout.maxC,
      cells: heat.map_data.features.map((f) => ({
        r: ((f.geometry.coordinates[0] ?? []).slice(0, 4))
          .map((pt) => [round6(pt[0]!), round6(pt[1]!)] as [number, number]),
        t: round6(f.properties.average_temperature),
      })),
    });

    // Tiles land about a minute before the parameters do, so they ship early
    // rather than making the user watch a spinner for the whole capture.
    patchJob(id, {
      stage: 'parameters',
      preview: { address: label, lat, lon, timezone, tileTemperatureC, granularityM: 100, ...layout },
    });

    const env = await client.envParams(lat, lon, tileTemperatureC, dateTime);
    const segmentId = `seg_${lat.toFixed(4)}_${lon.toFixed(4)}`;
    const { snapshots } = normalizeEnvParams(env, segmentId, timezone);
    if (snapshots.length === 0) throw new Error('FortyGuard returned no usable readings for this location.');

    patchJob(id, { stage: 'deciding' });
    const { building, assumptions } = buildingFor(label.split(',')[0] ?? 'Your building', lat, lon, floorAreaM2);
    const artifact = buildArtifact({
      fixture: { id: `live-${id}`, synthetic: false },
      snapshots: snapshots.map((s) => EnvSnapshot.parse(s)),
      building, capturedAt: new Date().toISOString(), date, tileTemperatureC,
    });

    patchJob(id, { stage: 'done', artifact, assumptions });

    try {
      await saveBuilding({
        id, orgId: account.orgId, address: label, lat, lon, floorAreaM2,
        building, createdBy: account.userId, createdAt: Date.now(),
      });
      await saveRun({ id: `${id}-run`, buildingId: id, capturedAt: Date.now(), artifact, assumptions });
    } catch (persistError) {
      // The capture itself succeeded — the user still gets their answer.
      // They just won't see it again tomorrow, which is a real but survivable gap.
      log.warn('failed to persist captured building', {
        id, error: persistError instanceof Error ? persistError.message : String(persistError),
      });
    }
  } catch (e) {
    failJob(id, e instanceof Error ? e.message : String(e));
  }
}
