import { describe, expect, it } from 'bun:test';
import type { EnvSnapshot } from '../src/contracts';
import { demoBuilding } from '../src/building';
import { emptyLatches, tintPolicy, type PolicyContext } from '../src/policies';

/** ~16:00 local in New York: the sun is well into the west. */
const LATE_AFTERNOON = new Date(Date.UTC(2026, 6, 18, 20));
const NOON = new Date(Date.UTC(2026, 6, 18, 16));

const env = (dniWm2: number, cloudCoverPercent: number, at: Date): EnvSnapshot => ({
  segmentId: demoBuilding.segmentId,
  timezone: 'America/New_York',
  intervalMin: 60,
  now: { at, apparentTempF: 92, wetBulbF: 74, pm25Aqi: 40, ozoneAqi: 30, cloudCoverPercent },
  forecast: [],
  clearSky: { ghiWm2: dniWm2, dniWm2, dhiWm2: 120 },
});

const ctx = (dni: number, cloudPct: number, at = LATE_AFTERNOON, over: Partial<PolicyContext> = {}): PolicyContext => ({
  at,
  building: demoBuilding,
  env: env(dni, cloudPct, at),
  indoor: { pm25: 6, co2Ppm: 600, zoneTempF: 72 },
  actuators: { outsideAirFraction: 0.2, setpointF: 72, tint: {}, demandResponse: false },
  latches: emptyLatches(),
  ...over,
});

const levelFor = (result: ReturnType<typeof tintPolicy>, facadeId: string) => {
  const p = result.proposals.find(
    (x) => x.command.actuator === 'facade_tint' && x.command.facadeId === facadeId);
  if (!p || p.command.actuator !== 'facade_tint') return undefined;
  return p.command.level;
};

describe('tinting', () => {
  it('darkens the west facade under a strong late afternoon beam', () => {
    expect(levelFor(tintPolicy(ctx(950, 0)), 'west')).toBe('dark');
  });

  it('leaves the north facade alone, since the beam never reaches it', () => {
    expect(levelFor(tintPolicy(ctx(950, 0)), 'north')).toBeUndefined();
  });

  /** The rail that is easy to skip and immediately visible when skipped. */
  it('does not tint on an overcast day despite a high clear sky value', () => {
    expect(levelFor(tintPolicy(ctx(950, 100)), 'west')).toBeUndefined();
  });

  it('tints less as cloud increases', () => {
    const clear = tintPolicy(ctx(950, 0)).state.beamByFacade['west']!;
    const cloudy = tintPolicy(ctx(950, 62)).state.beamByFacade['west']!;
    expect(cloudy).toBeLessThan(clear);
  });

  it('only ever proposes for facades that can actually be tinted', () => {
    const proposals = tintPolicy(ctx(950, 0)).proposals;
    const tintable = new Set(demoBuilding.facades.filter((f) => f.tintable).map((f) => f.id));
    for (const p of proposals) {
      if (p.command.actuator !== 'facade_tint') throw new Error('wrong actuator');
      expect(tintable.has(p.command.facadeId)).toBe(true);
    }
  });

  it('does not repeat a level the facade is already holding', () => {
    const already = ctx(950, 0, LATE_AFTERNOON, {
      actuators: { outsideAirFraction: 0.2, setpointF: 72, tint: { west: 'dark' }, demandResponse: false },
    });
    expect(levelFor(tintPolicy(already), 'west')).toBeUndefined();
  });

  it('proposes nothing at night', () => {
    expect(tintPolicy(ctx(950, 0, new Date(Date.UTC(2026, 6, 18, 5)))).proposals).toHaveLength(0);
  });

  it('is an energy decision', () => {
    expect(tintPolicy(ctx(950, 0)).proposals[0]!.priority).toBe('energy');
  });

  it('names the beam and the facade in the rationale', () => {
    const p = tintPolicy(ctx(950, 0)).proposals.find(
      (x) => x.command.actuator === 'facade_tint' && x.command.facadeId === 'west')!;
    expect(p.trigger.parameter).toContain('west');
    expect(p.rationale.toLowerCase()).toContain('beam');
  });

  it('favours the south facade at noon over the west', () => {
    const beams = tintPolicy(ctx(950, 0, NOON)).state.beamByFacade;
    expect(beams['south']!).toBeGreaterThan(beams['west']!);
  });
});
