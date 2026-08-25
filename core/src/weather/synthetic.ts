import type { EnvReading, EnvSnapshot } from '../contracts';
import { FORECAST_HORIZON_H, INTERVAL_MIN, intervalsInHours } from '../utils';

/**
 * Synthetic fixture generation.
 *
 * The vendor adapter needs a live key and a captured day. This produces the same
 * `EnvSnapshot` shape so every layer above it — policies, arbiter, twin, UI —
 * builds and is tested without waiting. When a captured day arrives it replaces
 * a synthetic one at this exact interface and nothing downstream changes.
 *
 * **Anything built from these carries `synthetic: true` and the UI must show it.**
 * docs/decisions/platform/determinism.md.
 */

export interface SyntheticDay {
  id: string;
  synthetic: true;
  segmentId: string;
  /** Local wall clock hour the series starts at. */
  startHourUtc: number;
  /** Number of intervals to generate. */
  hours: number;
  /** Interval index where the plume is densest. */
  plumePeakAt: number;
  plumePeakAqi: number;
  plumeWidth: number;
  baselineAqi: number;
  /** Interval index of the heat peak. */
  heatPeakAt: number;
  heatPeakF: number;
  heatBaseF: number;
  /** Interval index of solar noon. */
  solarNoonAt: number;
  peakDniWm2: number;
}

/**
 * The demo scenario: a hot afternoon with a smoke plume crossing this block.
 *
 * ⚠️ Synthetic. Replace with a captured day once B1 through B3 are resolved.
 */
export const HERO_DAY: SyntheticDay = {
  id: 'hero-synthetic',
  synthetic: true,
  segmentId: 'seg_40.7580_-73.9855',
  startHourUtc: 10,        // ~06:00 New York
  hours: 17,
  plumePeakAt: 9,          // ~15:00 local
  plumePeakAqi: 178,
  plumeWidth: 2.6,
  baselineAqi: 34,
  heatPeakAt: 10,
  heatPeakF: 103,
  heatBaseF: 76,
  solarNoonAt: 7,
  peakDniWm2: 910,
};

const bell = (i: number, centre: number, width: number) =>
  Math.exp(-((i - centre) ** 2) / (2 * width * width));

function readingAt(day: SyntheticDay, i: number): EnvReading {
  const at = new Date(Date.UTC(2026, 6, 18, day.startHourUtc + i * (INTERVAL_MIN / 60)));

  const plume = bell(i, day.plumePeakAt, day.plumeWidth);
  const pm25Aqi = day.baselineAqi + (day.plumePeakAqi - day.baselineAqi) * plume;

  // Ozone tracks heat and sunlight rather than the plume: a different driver,
  // so the two air quality latches are genuinely independent.
  const heat = bell(i, day.heatPeakAt, 3.4);
  const apparentTempF = day.heatBaseF + (day.heatPeakF - day.heatBaseF) * heat;
  const ozoneAqi = 28 + 64 * heat;

  // Wet bulb lags dry heat and stays well below it.
  const wetBulbF = 64 + 14 * bell(i, day.heatPeakAt + 0.5, 4);

  // Cloud builds slightly through the afternoon, which is what makes the
  // de rating step visible rather than decorative.
  const cloudCoverPercent = Math.min(100, Math.round(12 + 55 * bell(i, day.hours - 3, 4)));

  return { at, apparentTempF, wetBulbF, pm25Aqi, ozoneAqi, cloudCoverPercent };
}

export function buildSyntheticDay(day: SyntheticDay): EnvSnapshot[] {
  const readings = Array.from({ length: day.hours }, (_, i) => readingAt(day, i));
  const horizon = intervalsInHours(FORECAST_HORIZON_H);

  return readings.map((now, i) => ({
    segmentId: day.segmentId,
    timezone: 'America/New_York',
    intervalMin: INTERVAL_MIN,
    now,
    // Forward only, and never past the end of what actually happened.
    forecast: readings.slice(i + 1, i + 1 + horizon),
    clearSky: clearSkyAt(day, i),
  }));
}

function clearSkyAt(day: SyntheticDay, i: number) {
  const arc = Math.max(0, Math.cos(((i - day.solarNoonAt) / (day.hours / 2)) * Math.PI));
  const dniWm2 = day.peakDniWm2 * arc;
  return { ghiWm2: dniWm2 * 0.92, dniWm2, dhiWm2: dniWm2 * 0.18 };
}
