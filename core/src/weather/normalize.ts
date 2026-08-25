import type { EnvReading, EnvSnapshot } from '../contracts';
import { FORECAST_HORIZON_H, cToF, intervalsInHours } from '../utils';
import { log } from '../observability';

/**
 * Vendor response into our own shape.
 *
 * This is the only place FortyGuard's field names, units, and quirks are allowed
 * to exist. Everything above it deals in `EnvSnapshot`, which is why swapping a
 * captured day for a synthetic one costs nothing.
 *
 * Behaviour here is driven by observed responses, not the written docs, where
 * the two disagree. See docs/reference/fortyguard/api.md.
 */

/** `null`, and the legacy `-999` sentinel, both mean unavailable. Never zero. */
const MISSING = -999;
const isMissing = (v: unknown): boolean =>
  v === null || v === undefined || v === MISSING || !Number.isFinite(v as number);

/** `"1h"` → 60. The API does not document a fixed step, so it is read, not assumed. */
export function intervalToMinutes(interval: string): number {
  const match = /^(\d+)\s*([mh])$/i.exec(interval.trim());
  if (!match) throw new Error(`unrecognised interval "${interval}"; expected a form like "1h" or "15m"`);
  const value = Number(match[1]);
  return match[2]!.toLowerCase() === 'h' ? value * 60 : value;
}

interface NormalizeResult {
  snapshots: EnvSnapshot[];
  /** Readings discarded because a required parameter was unavailable. */
  dropped: number;
}

/**
 * `timezone` is supplied by the caller rather than read from the response.
 * `metadata.timezone` was observed returning `"GMT-5"` for New York in August,
 * which is EDT (-4): it appears to ignore daylight saving, so trusting it would
 * shift every decision by an hour.
 */
export function normalizeEnvParams(
  result: unknown,
  segmentId: string,
  timezone = 'America/New_York',
): NormalizeResult {
  const r = result as {
    metadata: { timestamps: string[]; time_range: { interval: string } };
    locations: Array<{
      parameters: Record<string, Array<number | null>>;
      solar_irradiance: { clear_sky: { ghi: number; dni: number; dhi: number } };
    }>;
  };

  const timestamps = r?.metadata?.timestamps ?? [];
  const location = r?.locations?.[0];
  if (timestamps.length === 0 || !location) {
    throw new Error('env_params response contained no usable readings');
  }

  const intervalMin = intervalToMinutes(r.metadata.time_range.interval);
  const p = location.parameters;

  // `timestamps` is the source of truth for length. `time_range.count` has been
  // observed to disagree with it.
  const readings: EnvReading[] = [];
  let dropped = 0;

  for (let i = 0; i < timestamps.length; i++) {
    const raw = {
      apparentC: p['apparent_temperature_celsius']?.[i],
      wetBulbC: p['wet_bulb_temperature_celsius']?.[i],
      pm25: p['air_quality_pm2p5:idx']?.[i],
      ozone: p['air_quality_o3:idx']?.[i],
      cloud: p['cloud_cover_octas']?.[i],
    };

    if (Object.values(raw).some(isMissing)) {
      dropped++;
      log.warn('dropped a reading with an unavailable parameter', { index: i, at: timestamps[i] });
      continue;
    }

    // Optional extras: absent in older fixtures, and never required for control.
    const num = (key: string) => {
      const v = p[key]?.[i];
      return typeof v === 'number' ? v : undefined;
    };
    const ambient = {
      heatIndexF: num('heat_index_celsius') === undefined ? undefined : cToF(num('heat_index_celsius')!),
      relativeHumidityPercent: num('relative_humidity_percent'),
      precipitationMm: num('precipitation_mm'),
      overallAqi: num('air_quality:idx'),
      pm10Aqi: num('air_quality_pm10:idx'),
      no2Aqi: num('air_quality_no2:idx'),
      coAqi: num('aqi_us_co'),
      so2Aqi: num('air_quality_so2:idx'),
      methanePpb: num('methane_ppb'),
    };

    readings.push({
      at: new Date(timestamps[i]!),
      apparentTempF: cToF(raw.apparentC as number),
      wetBulbF: cToF(raw.wetBulbC as number),
      pm25Aqi: raw.pm25 as number,
      ozoneAqi: raw.ozone as number,
      // Named octas, carries percent. Passed through unscaled on purpose.
      cloudCoverPercent: raw.cloud as number,
      ...(num('co2_ppm') === undefined ? {} : { outdoorCo2Ppm: num('co2_ppm') }),
      ...(Object.values(ambient).every((v) => v === undefined) ? {} : { ambient }),
    });
  }

  const clearSky = {
    ghiWm2: location.solar_irradiance.clear_sky.ghi,
    dniWm2: location.solar_irradiance.clear_sky.dni,
    dhiWm2: location.solar_irradiance.clear_sky.dhi,
  };

  const horizon = intervalsInHours(FORECAST_HORIZON_H);
  const snapshots = readings.map((now, i) => ({
    segmentId,
    timezone,
    intervalMin,
    now,
    forecast: readings.slice(i + 1, i + 1 + horizon),
    clearSky,
  }));

  return { snapshots, dropped };
}
