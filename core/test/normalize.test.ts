import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { EnvSnapshot } from '../src/contracts';
import { log } from '../src/observability';
import { intervalToMinutes, normalizeEnvParams } from '../src/weather/normalize';

/** The real trimmed response from a live call. docs/reference/fortyguard/samples/. */
const live = await Bun.file(
  new URL('../../docs/reference/fortyguard/samples/env_params.response.json', import.meta.url),
).json();

const SEG = 'seg_40.7580_-73.9855';
const { snapshots, dropped } = normalizeEnvParams(live, SEG);

describe('interval parsing', () => {
  it('reads the hourly step the API actually returns', () => {
    expect(intervalToMinutes('1h')).toBe(60);
  });

  it('handles sub hourly and multi hour steps', () => {
    expect(intervalToMinutes('15m')).toBe(15);
    expect(intervalToMinutes('3h')).toBe(180);
  });

  it('refuses a step it does not understand rather than assuming 60', () => {
    expect(() => intervalToMinutes('fortnightly')).toThrow();
  });
});

describe('normalizing a real response', () => {
  it('produces one snapshot per timestamp, not per the count field', () => {
    // `count` says 17 in this trimmed sample while only 5 timestamps are present.
    // The timestamps array is the source of truth.
    expect(snapshots).toHaveLength(live.metadata.timestamps.length);
    expect(dropped).toBe(0);
  });

  it('emits snapshots that satisfy the contract', () => {
    for (const s of snapshots) expect(() => EnvSnapshot.parse(s)).not.toThrow();
  });

  it('carries the interval through from metadata instead of hardcoding it', () => {
    expect(snapshots[0]!.intervalMin).toBe(60);
  });

  it('binds every snapshot to the segment it was requested for', () => {
    for (const s of snapshots) expect(s.segmentId).toBe(SEG);
  });
});

describe('unit conversion at the boundary', () => {
  it('converts apparent temperature from Celsius to Fahrenheit', () => {
    const c = live.locations[0].parameters.apparent_temperature_celsius[0];
    expect(snapshots[0]!.now.apparentTempF).toBeCloseTo(c * 9 / 5 + 32, 6);
  });

  it('converts wet bulb from Celsius to Fahrenheit', () => {
    const c = live.locations[0].parameters.wet_bulb_temperature_celsius[0];
    expect(snapshots[0]!.now.wetBulbF).toBeCloseTo(c * 9 / 5 + 32, 6);
  });

  /** The field is named octas but carries percent. Pass it through unscaled. */
  it('treats cloud cover as percent, matching what the field actually contains', () => {
    expect(snapshots[0]!.now.cloudCoverPercent).toBe(live.locations[0].parameters.cloud_cover_octas[0]);
  });

  it('keeps air quality as the AQI index it already is', () => {
    expect(snapshots[0]!.now.pm25Aqi).toBe(live.locations[0].parameters['air_quality_pm2p5:idx'][0]);
    expect(snapshots[0]!.now.ozoneAqi).toBe(live.locations[0].parameters['air_quality_o3:idx'][0]);
  });

  it('takes irradiance from the clear sky block', () => {
    expect(snapshots[0]!.clearSky.dniWm2).toBe(live.locations[0].solar_irradiance.clear_sky.dni);
  });
});

describe('the forecast attached to each snapshot', () => {
  it('looks forward only', () => {
    for (const s of snapshots) {
      for (const f of s.forecast) expect(f.at.getTime()).toBeGreaterThan(s.now.at.getTime());
    }
  });

  it('runs out at the end of the response rather than inventing readings', () => {
    expect(snapshots.at(-1)!.forecast).toHaveLength(0);
  });

  it('matches what the later snapshots actually report', () => {
    expect(snapshots[0]!.forecast[0]!.pm25Aqi).toBe(snapshots[1]!.now.pm25Aqi);
  });
});

describe('missing values', () => {
  let warnings: string[] = [];
  beforeEach(() => { warnings = []; log.setSink((level, message) => { if (level === 'warn') warnings.push(message); }); });
  afterEach(() => { log.setSink(undefined); });

  const withGap = (value: unknown) => {
    const copy = structuredClone(live);
    copy.locations[0].parameters['air_quality_pm2p5:idx'][1] = value;
    return normalizeEnvParams(copy, SEG);
  };

  it('drops a reading whose required parameter is null, never treating it as zero', () => {
    const { snapshots: s, dropped: d } = withGap(null);
    expect(d).toBe(1);
    expect(s).toHaveLength(live.metadata.timestamps.length - 1);
    expect(s.some((x) => x.now.pm25Aqi === 0)).toBe(false);
  });

  it('treats the legacy -999 sentinel the same as null', () => {
    expect(withGap(-999).dropped).toBe(1);
  });

  it('announces the drop rather than discarding data silently', () => {
    withGap(null);
    expect(warnings.length).toBe(1);
  });

  it('throws when the response has no usable readings at all', () => {
    const empty = structuredClone(live);
    empty.metadata.timestamps = [];
    expect(() => normalizeEnvParams(empty, SEG)).toThrow();
  });
});
