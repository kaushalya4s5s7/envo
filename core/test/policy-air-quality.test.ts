import { describe, expect, it } from 'bun:test';
import type { EnvReading, EnvSnapshot } from '../src/contracts';
import { demoBuilding } from '../src/building';
import { AIR } from '../src/utils';
import { airQualityPolicy, emptyLatches, type PolicyContext } from '../src/policies';

const CLEAN = 40;                       // AQI, comfortably "Good"
const UNHEALTHY = AIR.PM25_AQI_CLOSE + 20;
const DEAD_BAND = 130;                  // between reopen (101) and close (151)

const reading = (over: Partial<EnvReading> = {}): EnvReading => ({
  at: new Date('2026-07-18T15:00:00Z'),
  apparentTempF: 88, wetBulbF: 72, pm25Aqi: CLEAN, ozoneAqi: 30, cloudCoverPercent: 24, ...over,
});

const env = (now: Partial<EnvReading>, forecast: Array<Partial<EnvReading>> = []): EnvSnapshot => ({
  segmentId: demoBuilding.segmentId,
  timezone: 'America/New_York',
  intervalMin: 60,
  now: reading(now),
  forecast: forecast.map((f) => reading(f)),
  clearSky: { ghiWm2: 700, dniWm2: 400, dhiWm2: 120 },
});

const ctx = (over: Partial<PolicyContext> = {}): PolicyContext => ({
  at: new Date('2026-07-18T15:00:00Z'),
  building: demoBuilding,
  env: env({}),
  indoor: { pm25: 6, co2Ppm: 600, zoneTempF: 72 },
  actuators: { outsideAirFraction: 0.2, setpointF: 72, tint: {}, demandResponse: false },
  latches: emptyLatches(),
  ...over,
});

/** Feed a series of AQI values through the policy, carrying latches forward. */
const run = (series: number[], base: Partial<PolicyContext> = {}) => {
  let latches = emptyLatches();
  return series.map((pm25Aqi) => {
    const result = airQualityPolicy(ctx({ ...base, env: env({ pm25Aqi }), latches }));
    latches = result.latches;
    return result;
  });
};

const closes = (r: { proposals: Array<{ command: { actuator: string } }> }) =>
  r.proposals.some((p) => p.command.actuator === 'outside_air_damper');

describe('closing the intake', () => {
  it('does not close while the air stays below the breakpoint', () => {
    expect(run([CLEAN, CLEAN, CLEAN]).some(closes)).toBe(false);
  });

  it('closes on the interval the breakpoint is crossed', () => {
    const steps = run([CLEAN, UNHEALTHY]);
    expect(closes(steps[0]!)).toBe(false);
    expect(closes(steps[1]!)).toBe(true);
  });

  /**
   * Reduce outdoor air, never eliminate it.
   *
   * Sealing to zero traded one hazard for another: BOPTEST scored a fully sealed
   * office at 219× the indoor air quality penalty of doing nothing, because CO₂
   * climbed 230 ppm/h with the occupants still breathing. Wildfire guidance says
   * to modulate the damper down, not shut it.
   * docs/decisions/platform/sandbox-findings.md
   */
  it('holds a minimum ventilation floor rather than shutting the intake', () => {
    const closing = run([UNHEALTHY, UNHEALTHY]).at(-1)!;
    const proposal = closing.proposals.find((p) => p.command.actuator === 'outside_air_damper')!;
    expect(proposal.priority).toBe('health');
    expect(proposal.command).toMatchObject({ mode: 'recirculate', highMerv: true });
    if (proposal.command.actuator !== 'outside_air_damper') throw new Error('wrong actuator');
    expect(proposal.command.outsideAirFraction).toBe(AIR.SEAL_OA_FRACTION);
    expect(proposal.command.outsideAirFraction).toBeGreaterThan(0);
  });

  it('cuts ventilation at least in half, or it is not protecting anything', () => {
    expect(AIR.SEAL_OA_FRACTION).toBeLessThanOrEqual(AIR.NORMAL_OA_FRACTION / 2);
    expect(AIR.SEAL_OA_FRACTION).toBeGreaterThan(0);
  });

  it('triggers on ozone independently of particulates', () => {
    const steps = [AIR.O3_AQI_CLOSE + 10, AIR.O3_AQI_CLOSE + 10].reduce<{ latches: ReturnType<typeof emptyLatches>; out: ReturnType<typeof airQualityPolicy>[] }>(
      (acc, ozoneAqi) => {
        const r = airQualityPolicy(ctx({ env: env({ pm25Aqi: CLEAN, ozoneAqi }), latches: acc.latches }));
        return { latches: r.latches, out: [...acc.out, r] };
      }, { latches: emptyLatches(), out: [] });
    expect(closes(steps.out.at(-1)!)).toBe(true);
  });
});

describe('reopening', () => {
  it('holds closed inside the dead band', () => {
    const steps = run([UNHEALTHY, UNHEALTHY, DEAD_BAND, DEAD_BAND, DEAD_BAND, DEAD_BAND, DEAD_BAND]);
    expect(steps.at(-1)!.state.sealed).toBe(true);
  });

  it('takes longer to reopen than it took to close', () => {
    const series = [UNHEALTHY, UNHEALTHY, ...Array<number>(AIR.PERSIST_REOPEN).fill(CLEAN)];
    const steps = run(series);
    expect(steps[2]!.state.sealed).toBe(true);                      // still sealed one clean sample in
    expect(steps.at(-1)!.state.sealed).toBe(false);
  });

  it('does not chatter across a signal oscillating on the breakpoint', () => {
    const oscillating = Array.from({ length: 40 }, (_, i) => AIR.PM25_AQI_CLOSE + (i % 2 ? -1 : 1));
    const sealed = run(oscillating).map((r) => r.state.sealed);
    const flips = sealed.filter((v, i) => i > 0 && v !== sealed[i - 1]).length;
    expect(flips).toBeLessThanOrEqual(1);
  });
});

describe('the CO2 escape hatch', () => {
  const stuffy = { pm25: 6, co2Ppm: AIR.CO2_CEILING_PPM + 50, zoneTempF: 72 };

  it('waits when a cleaner window is coming, and says when', () => {
    const result = airQualityPolicy(ctx({
      indoor: stuffy,
      env: env({ pm25Aqi: UNHEALTHY }, [{ pm25Aqi: UNHEALTHY }, { pm25Aqi: CLEAN }]),
      latches: run([UNHEALTHY, UNHEALTHY]).at(-1)!.latches,
    }));
    const purge = result.proposals.find((p) => p.command.actuator === 'outside_air_damper'
      && p.command.mode === 'purge');
    expect(purge).toBeUndefined();
    expect(result.state.purgePlannedFor).not.toBeNull();
  });

  it('purges when now is the cleanest moment available', () => {
    const result = airQualityPolicy(ctx({
      indoor: stuffy,
      env: env({ pm25Aqi: DEAD_BAND }, [{ pm25Aqi: UNHEALTHY }, { pm25Aqi: UNHEALTHY }]),
      latches: run([UNHEALTHY, UNHEALTHY]).at(-1)!.latches,
    }));
    const purge = result.proposals.find((p) => p.command.actuator === 'outside_air_damper'
      && p.command.mode === 'purge');
    expect(purge).toBeDefined();
    expect(purge!.priority).toBe('health');
  });

  it('does not purge while CO2 is below the ceiling', () => {
    const result = airQualityPolicy(ctx({
      indoor: { pm25: 6, co2Ppm: 700, zoneTempF: 72 },
      env: env({ pm25Aqi: DEAD_BAND }),
      latches: run([UNHEALTHY, UNHEALTHY]).at(-1)!.latches,
    }));
    expect(result.proposals.some((p) => p.command.actuator === 'outside_air_damper'
      && p.command.mode === 'purge')).toBe(false);
  });
});

describe('every proposal', () => {
  it('carries a non empty rationale naming the parameter that caused it', () => {
    const all = run([UNHEALTHY, UNHEALTHY]).flatMap((r) => r.proposals);
    expect(all.length).toBeGreaterThan(0);
    for (const p of all) {
      expect(p.rationale.length).toBeGreaterThan(0);
      expect(p.trigger.parameter.length).toBeGreaterThan(0);
      expect(p.trigger.sustainedIntervals).toBeGreaterThanOrEqual(0);
    }
  });

  it('proposes nothing at all when the air is clean and the building is fresh', () => {
    expect(run([CLEAN, CLEAN, CLEAN]).at(-1)!.proposals).toHaveLength(0);
  });
});

/**
 * B5. On the hourly grid FortyGuard actually returns, requiring two sustained
 * hours above the EPA Unhealthy threshold means a real ozone event that peaks
 * for one hour is missed entirely. Verified against the captured 2026-08-07 day,
 * where ozone reached exactly AQI 151 for a single hour.
 *
 * Closing is therefore allowed on one sustained interval. Reopening is not:
 * the asymmetry is preserved, and is now much wider.
 */
describe('acting fast enough to matter on an hourly grid', () => {
  it('closes on a single hour above the Unhealthy threshold', () => {
    expect(AIR.PERSIST_CLOSE).toBe(1);
    expect(closes(run([UNHEALTHY]).at(-1)!)).toBe(true);
  });

  it('still refuses to reopen quickly', () => {
    expect(AIR.PERSIST_REOPEN).toBeGreaterThan(AIR.PERSIST_CLOSE);
    const steps = run([UNHEALTHY, CLEAN, CLEAN]);
    expect(steps.at(-1)!.state.sealed).toBe(true);
  });

  it('reproduces the real ozone event that the old setting missed', () => {
    // Ozone hours from fixtures/demo-nyc-001-2026-08-07.json, evening peak.
    const ozone = [114, 137, 150, 151, 142, 124, 104, 82];
    let latches = emptyLatches();
    const sealedAt = ozone.map((ozoneAqi) => {
      const r = airQualityPolicy(ctx({ env: env({ pm25Aqi: CLEAN, ozoneAqi }), latches }));
      latches = r.latches;
      return r.state.sealed;
    });
    expect(sealedAt[3]).toBe(true);          // the hour it touches 151
    expect(sealedAt.slice(0, 3).some(Boolean)).toBe(false);
  });

  it('does not fire on a single hour that never reaches the threshold', () => {
    expect(run([AIR.PM25_AQI_CLOSE - 1]).at(-1)!.state.sealed).toBe(false);
  });
});

/**
 * Regression tests for the two defects the BOPTEST sandbox exposed.
 * See docs/decisions/platform/sandbox-findings.md.
 *
 * On a real captured day the intake sealed on ozone at 19:00 and CO2 then climbed
 * about 230 ppm per hour to 1622 ppm before the purge fired, two hours after the
 * ceiling was crossed. Lowering the ceiling by 300 ppm changed nothing at all,
 * which proved the ceiling was never the binding constraint.
 */
describe('the CO2 escape hatch actually escapes', () => {
  const sealedLatches = () => run([UNHEALTHY]).at(-1)!.latches;
  const purgeOf = (r: ReturnType<typeof airQualityPolicy>) =>
    r.proposals.find((p) => p.command.actuator === 'outside_air_damper' && p.command.mode === 'purge');

  /** Defect 1: the window search looked at PM2.5 while ozone was the hazard. */
  it('waits for the cleanest window across every pollutant, not just particulates', () => {
    const result = airQualityPolicy(ctx({
      indoor: { pm25: 6, co2Ppm: AIR.CO2_CEILING_PPM + 20, zoneTempF: 72 },
      // Particulates improve ahead, but ozone is far worse. The later hour is not cleaner.
      env: env({ pm25Aqi: 60, ozoneAqi: 40 }, [{ pm25Aqi: 40, ozoneAqi: 190 }]),
      latches: sealedLatches(),
    }));
    expect(purgeOf(result)).toBeDefined();
  });

  it('still defers when a genuinely cleaner hour is ahead on every pollutant', () => {
    const result = airQualityPolicy(ctx({
      indoor: { pm25: 6, co2Ppm: AIR.CO2_CEILING_PPM + 20, zoneTempF: 72 },
      env: env({ pm25Aqi: 140, ozoneAqi: 140 }, [{ pm25Aqi: 40, ozoneAqi: 40 }]),
      latches: sealedLatches(),
    }));
    expect(purgeOf(result)).toBeUndefined();
    expect(result.state.purgePlannedFor).not.toBeNull();
  });

  /** Defect 2: with a monotonically improving forecast, "now" was never cleanest. */
  it('purges regardless once CO2 reaches the hard limit', () => {
    const result = airQualityPolicy(ctx({
      indoor: { pm25: 6, co2Ppm: AIR.CO2_HARD_PPM, zoneTempF: 72 },
      // Every future hour is cleaner, so the window search alone would defer forever.
      env: env({ pm25Aqi: 190, ozoneAqi: 190 }, [
        { pm25Aqi: 150, ozoneAqi: 150 }, { pm25Aqi: 100, ozoneAqi: 100 }, { pm25Aqi: 50, ozoneAqi: 50 },
      ]),
      latches: sealedLatches(),
    }));
    const purge = purgeOf(result);
    expect(purge).toBeDefined();
    expect(purge!.rationale).toContain('hard limit');
    expect(result.state.purgePlannedFor).toBeNull();
  });

  it('reproduces the captured day: 1622 ppm would have forced a purge', () => {
    const result = airQualityPolicy(ctx({
      indoor: { pm25: 6, co2Ppm: 1622, zoneTempF: 72 },
      env: env({ pm25Aqi: 62, ozoneAqi: 104 }, [{ pm25Aqi: 59, ozoneAqi: 82 }]),
      latches: sealedLatches(),
    }));
    expect(purgeOf(result)).toBeDefined();
  });

  it('keeps the hard limit above the ceiling, so the window search still gets a chance', () => {
    expect(AIR.CO2_HARD_PPM).toBeGreaterThan(AIR.CO2_CEILING_PPM);
  });

  it('does nothing while CO2 is below the ceiling', () => {
    const result = airQualityPolicy(ctx({
      indoor: { pm25: 6, co2Ppm: 700, zoneTempF: 72 },
      env: env({ pm25Aqi: 190, ozoneAqi: 190 }),
      latches: sealedLatches(),
    }));
    expect(purgeOf(result)).toBeUndefined();
  });
});
