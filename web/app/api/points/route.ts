import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { BoptestClient } from 'core/bms/boptest';
import { suggestMappings, type DiscoveredPoint } from 'core/connect';

export const runtime = 'nodejs';
export const maxDuration = 600;

const BASE = process.env['BOPTEST_URL'] ?? 'http://127.0.0.1:8000';

/**
 * Point discovery — the real first step of connecting a building.
 *
 * Live discovery talks to a BOPTEST session over the same `BmsAdapter` seam a
 * real BMS would sit behind. When no emulator is reachable it serves a committed
 * snapshot of a genuine discovery, and says which one you are looking at.
 */

interface RawPoint { Unit?: string | null; Description?: string; Minimum?: number | null; Maximum?: number | null }

const convert = (obj: Record<string, RawPoint>, kind: 'input' | 'measurement'): DiscoveredPoint[] =>
  Object.entries(obj)
    // `_activate` flags are transport plumbing, not points an operator maps.
    .filter(([name]) => !name.endsWith('_activate'))
    .map(([name, v]) => ({
      name, description: v.Description ?? '', unit: v.Unit ?? null,
      min: v.Minimum ?? null, max: v.Maximum ?? null, kind,
    }));

async function committed() {
  const file = path.join(process.cwd(), '..', 'fixtures', 'boptest-points.json');
  return JSON.parse(await readFile(file, 'utf8')) as {
    capturedAt: string; testcase: string; points: DiscoveredPoint[];
  };
}

export async function GET(request: Request) {
  const live = new URL(request.url).searchParams.get('live') === '1';

  if (live) {
    const client = new BoptestClient(BASE);
    try {
      await client.select('multizone_office_simple_air');
      const [inputs, measurements] = await Promise.all([client.inputs(), client.measurements()]);
      const points = [
        ...convert(inputs as Record<string, RawPoint>, 'input'),
        ...convert(measurements as Record<string, RawPoint>, 'measurement'),
      ];
      return NextResponse.json({
        source: 'live', testcase: 'multizone_office_simple_air',
        discoveredAt: new Date().toISOString(), points, mappings: suggestMappings(points),
      });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : String(e) }, { status: 503 },
      );
    } finally {
      // A session left open holds the single worker until BOPTEST times it out
      // fourteen minutes later, which blocks every other run on the machine.
      await client.stop().catch(() => {});
    }
  }

  const snap = await committed();
  return NextResponse.json({
    source: 'committed', testcase: snap.testcase, discoveredAt: snap.capturedAt,
    points: snap.points, mappings: suggestMappings(snap.points),
  });
}
