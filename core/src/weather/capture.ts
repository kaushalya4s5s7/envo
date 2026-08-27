import { writeFile } from 'node:fs/promises';
import type { Building } from '../contracts';
import { log } from '../observability';
import { FortyGuardClient, boxAround, tileTemperatureAt, type DateTimeRange } from './fortyguard';
import { normalizeEnvParams } from './normalize';

/**
 * Capture one real day into a committed fixture.
 *
 * Run once, replay forever. A rate limit, a network drop, or a slow heatmap poll
 * on stage would kill the demo, and both strategies must consume an identical
 * signal stream or the comparison is not reproducible.
 * docs/decisions/platform/determinism.md
 */

export interface CaptureOptions {
  apiKey: string;
  building: Building;
  /** `YYYY-MM-DD`, between 2019-01-01 and now + 12 h. */
  date: string;
  startTime: string;
  endTime: string;
  /** Half width of the area of interest, degrees. */
  halfDeg?: number;
  granularity?: 60 | 80 | 100;
}

export async function captureDay(options: CaptureOptions) {
  const { apiKey, building, date, startTime, endTime, halfDeg = 0.006, granularity = 60 } = options;
  const client = new FortyGuardClient({ apiKey });

  // Range of hours in one task, rather than one call per hour.
  const dateTime: DateTimeRange = {
    start_date: date,
    start_time: startTime,
    end_time: endTime,
    filter_type: 2,
  };

  // 1. Heatmap first. Not optional context: env_params requires its temperature.
  const heat = (await client.heatmap(
    boxAround(building.lat, building.lon, halfDeg), dateTime, granularity,
  )) as { map_data: Parameters<typeof tileTemperatureAt>[0] };

  const temperatureC = tileTemperatureAt(heat.map_data, building.lat, building.lon);
  log.info('read tile temperature for this building', { temperatureC, segmentId: building.segmentId });

  // 2. Parameters for the same location and window, seeded with that temperature.
  const env = await client.envParams(building.lat, building.lon, temperatureC, dateTime);
  const { snapshots, dropped } = normalizeEnvParams(env, building.segmentId);

  return {
    fixture: {
      id: `${building.id}-${date}`,
      synthetic: false as const,
      capturedAt: new Date().toISOString(),
      building: building.id,
      date,
      window: `${startTime}-${endTime}`,
      granularity,
      tileTemperatureC: temperatureC,
      droppedReadings: dropped,
    },
    snapshots,
  };
}

export async function writeFixture(path: string, captured: Awaited<ReturnType<typeof captureDay>>) {
  await writeFile(path, `${JSON.stringify(captured, null, 2)}\n`);
  log.info('fixture written', { path, intervals: captured.snapshots.length });
}
