import { describe, expect, it } from 'bun:test';
import { beamOnFacade, derateForCloud, solarPosition } from '../src/weather/solar';

/** Demo building's location. Northern hemisphere, mid latitude. */
const NYC = { lat: 40.758, lon: -73.9855 };
const july = (hUtc: number) => new Date(Date.UTC(2026, 6, 18, hUtc));

describe('solar position', () => {
  it('puts the sun below the horizon at local midnight', () => {
    expect(solarPosition(july(5), NYC).altitudeDeg).toBeLessThan(0);   // 01:00 local
  });

  it('puts the sun high at local solar noon in July', () => {
    const noon = solarPosition(july(16), NYC);                          // ~12:00 local
    expect(noon.altitudeDeg).toBeGreaterThan(60);
  });

  it('moves the sun from east to west across the day', () => {
    const morning = solarPosition(july(13), NYC).azimuthDeg;            // ~09:00 local
    const afternoon = solarPosition(july(20), NYC).azimuthDeg;          // ~16:00 local
    expect(morning).toBeLessThan(180);                                  // east of south
    expect(afternoon).toBeGreaterThan(180);                             // west of south
  });
});

describe('beam on a facade', () => {
  const dni = 800;

  it('is zero when the sun is behind the facade', () => {
    // Sun in the west, facade pointing east.
    expect(beamOnFacade(dni, 90, solarPosition(july(21), NYC))).toBe(0);
  });

  it('is zero at night regardless of orientation', () => {
    expect(beamOnFacade(dni, 270, solarPosition(july(5), NYC))).toBe(0);
  });

  it('peaks on the west facade in the late afternoon, not at noon', () => {
    const atNoon = beamOnFacade(dni, 270, solarPosition(july(16), NYC));
    const lateAfternoon = beamOnFacade(dni, 270, solarPosition(july(21), NYC));
    expect(lateAfternoon).toBeGreaterThan(atNoon);
  });

  it('never exceeds the direct normal irradiance itself', () => {
    for (let h = 10; h <= 23; h++) {
      expect(beamOnFacade(dni, 270, solarPosition(july(h), NYC))).toBeLessThanOrEqual(dni);
    }
  });
});

describe('cloud de rating', () => {
  it('leaves a clear sky untouched', () => {
    expect(derateForCloud(800, 0)).toBe(800);
  });

  it('collapses the beam under full overcast', () => {
    expect(derateForCloud(800, 100)).toBeLessThan(800 * 0.15);
  });

  it('falls monotonically as cloud increases', () => {
    const series = [0, 17, 36, 48, 63, 70, 88, 98].map((pct) => derateForCloud(800, pct));
    for (let i = 1; i < series.length; i++) expect(series[i]!).toBeLessThanOrEqual(series[i - 1]!);
  });

  it('rejects a value outside 0..100 rather than clamping', () => {
    expect(() => derateForCloud(800, 101)).toThrow();
  });
});
