import { describe, expect, it } from 'bun:test';
import { AIR, FORECAST_HORIZON_H, INTERVAL_MIN } from '../src/utils';
import { HERO_DAY, buildSyntheticDay } from '../src/weather/synthetic';

const day = buildSyntheticDay(HERO_DAY);

describe('synthetic day', () => {
  it('produces one snapshot per interval across the requested span', () => {
    expect(day).toHaveLength(HERO_DAY.hours);
    expect(day[0]!.intervalMin).toBe(INTERVAL_MIN);
  });

  it('is deterministic — the same config yields the same series', () => {
    const again = buildSyntheticDay(HERO_DAY);
    expect(again.map((s) => s.now.pm25Aqi)).toEqual(day.map((s) => s.now.pm25Aqi));
  });

  it('advances the clock by exactly one interval per snapshot', () => {
    const gap = day[1]!.now.at.getTime() - day[0]!.now.at.getTime();
    expect(gap).toBe(INTERVAL_MIN * 60_000);
  });

  it('binds every snapshot to the same segment', () => {
    expect(new Set(day.map((s) => s.segmentId)).size).toBe(1);
  });
});

describe('the forecast each snapshot carries', () => {
  it('looks forward, never backward', () => {
    for (const snapshot of day) {
      for (const f of snapshot.forecast) expect(f.at.getTime()).toBeGreaterThan(snapshot.now.at.getTime());
    }
  });

  it('is trimmed to the vendor horizon of 12 hours', () => {
    for (const snapshot of day) expect(snapshot.forecast.length).toBeLessThanOrEqual(FORECAST_HORIZON_H);
  });

  it('agrees with what actually happens later in the day', () => {
    const first = day[0]!;
    expect(first.forecast[0]!.pm25Aqi).toBeCloseTo(day[1]!.now.pm25Aqi, 5);
  });

  it('runs out as the day ends rather than inventing readings', () => {
    expect(day.at(-1)!.forecast).toHaveLength(0);
  });
});

describe('the hero scenario', () => {
  it('crosses the Unhealthy breakpoint for long enough to trigger a close', () => {
    const over = day.filter((s) => s.now.pm25Aqi >= AIR.PM25_AQI_CLOSE);
    expect(over.length).toBeGreaterThanOrEqual(AIR.PERSIST_CLOSE);
  });

  it('starts and ends clean, so the reopen path is exercised too', () => {
    expect(day[0]!.now.pm25Aqi).toBeLessThan(AIR.PM25_AQI_REOPEN);
    expect(day.at(-1)!.now.pm25Aqi).toBeLessThan(AIR.PM25_AQI_REOPEN);
  });

  it('carries a heat peak that a pre cool decision can act on', () => {
    const peak = Math.max(...day.map((s) => s.now.apparentTempF));
    expect(peak).toBeGreaterThan(day[0]!.now.apparentTempF + 10);
  });

  it('has a sun that rises and sets', () => {
    expect(day[0]!.clearSky.dniWm2).toBeGreaterThanOrEqual(0);
    expect(Math.max(...day.map((s) => s.clearSky.dniWm2))).toBeGreaterThan(600);
  });

  it('is labelled synthetic, so nothing downstream can present it as captured', () => {
    expect(HERO_DAY.synthetic).toBe(true);
  });
});
