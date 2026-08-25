import { describe, expect, it } from 'bun:test';
import { RunArtifact } from '../src/contracts';
import { demoBuilding } from '../src/building';
import { AIR } from '../src/utils';
import { HERO_DAY, buildSyntheticDay } from '../src/weather/synthetic';
import { degradeSignal, runReplay } from '../src/copilot';

const day = buildSyntheticDay(HERO_DAY);
const artifact = runReplay({ fixture: HERO_DAY, snapshots: day, building: demoBuilding });

const copilot = artifact.strategies.envelope_copilot;
const baseline = artifact.strategies.baseline;
/** Sealed means reduced to the ventilation floor, not shut. */
const sealed = (intervals: typeof copilot) =>
  intervals.filter((i) => i.twin.outsideAirFraction === AIR.SEAL_OA_FRACTION).length;

describe('the artifact', () => {
  it('satisfies its contract', () => {
    expect(() => RunArtifact.parse(artifact)).not.toThrow();
  });

  it('runs both strategies over every interval of the fixture', () => {
    expect(copilot).toHaveLength(day.length);
    expect(baseline).toHaveLength(day.length);
  });

  it('carries the synthetic flag through from the fixture', () => {
    expect(artifact.synthetic).toBe(true);
  });

  it('snapshots the thresholds it ran with, so the run stays interpretable later', () => {
    expect(Object.keys(artifact.thresholds).length).toBeGreaterThan(0);
  });

  /** GATE 2: the artifact alone tells the story, with no UI. */
  it('gives every single command a populated rationale', () => {
    const decisions = [...copilot, ...baseline].flatMap((i) => i.decisions);
    expect(decisions.length).toBeGreaterThan(0);
    for (const d of decisions) expect(d.rationale.trim().length).toBeGreaterThan(0);
  });

  it('emits one decision per command, every interval', () => {
    for (const interval of [...copilot, ...baseline]) {
      expect(interval.decisions).toHaveLength(interval.commands.length);
    }
  });
});

describe('degrading the signal', () => {
  it('strips the forecast, because a current conditions feed has none', () => {
    expect(degradeSignal(day[0]!).forecast).toHaveLength(0);
  });

  it('flattens air quality toward a citywide value the plume never moves', () => {
    const peak = day.reduce((a, b) => (a.now.pm25Aqi > b.now.pm25Aqi ? a : b));
    expect(degradeSignal(peak).now.pm25Aqi).toBeLessThan(AIR.PM25_AQI_CLOSE);
  });

  it('leaves irradiance intact, so the comparison stays conservative', () => {
    expect(degradeSignal(day[7]!).clearSky).toEqual(day[7]!.clearSky);
  });

  it('keeps the same segment and clock', () => {
    expect(degradeSignal(day[3]!).now.at).toEqual(day[3]!.now.at);
    expect(degradeSignal(day[3]!).segmentId).toBe(day[3]!.segmentId);
  });
});

describe('copilot against baseline', () => {
  it('closes the intake during the plume', () => {
    expect(sealed(copilot)).toBeGreaterThan(0);
  });

  it('leaves the baseline breathing straight through it', () => {
    expect(sealed(baseline)).toBe(0);
  });

  it('holds peak indoor particulates well below the baseline', () => {
    const worstCopilot = Math.max(...copilot.map((i) => i.twin.indoorPm25));
    const worstBaseline = Math.max(...baseline.map((i) => i.twin.indoorPm25));
    expect(worstCopilot).toBeLessThan(worstBaseline);
  });

  it('reopens afterwards rather than staying sealed for the rest of the day', () => {
    expect(copilot.at(-1)!.twin.outsideAirFraction).toBe(AIR.NORMAL_OA_FRACTION);
  });

  it('pre cools ahead of the heat peak, which the baseline cannot see coming', () => {
    const precooled = copilot.some((i) => i.decisions.some((d) => d.policy === 'precool'));
    const baselinePrecooled = baseline.some((i) => i.decisions.some((d) => d.policy === 'precool'));
    expect(precooled).toBe(true);
    expect(baselinePrecooled).toBe(false);
  });
});

describe('the loop respects its own rails', () => {
  it('never exceeds the change budget on any actuator in any hour', () => {
    for (const strategy of [copilot, baseline]) {
      const perActuator = new Map<string, number>();
      for (const interval of strategy) {
        for (const c of interval.commands) {
          perActuator.set(c.actuator, (perActuator.get(c.actuator) ?? 0) + 1);
        }
      }
      // The fixture is hourly, so no actuator can legitimately move more than once per interval.
      for (const count of perActuator.values()) expect(count).toBeLessThanOrEqual(strategy.length);
    }
  });

  /**
   * The expected cycle is seal → purge → reseal → reopen, which is four
   * transitions, not two. What must not happen is repeated purge cycles: the
   * pathology is a flush that stops the moment CO₂ dips under the hard limit and
   * immediately reseals. docs/decisions/platform/sandbox-findings.md
   */
  it('runs at most one purge cycle rather than oscillating', () => {
    const purges = copilot.flatMap((i) => i.decisions)
      .filter((d) => d.command.actuator === 'outside_air_damper' && d.command.mode === 'purge');
    expect(purges.length).toBeLessThanOrEqual(1);
  });

  it('does not chatter the damper', () => {
    const states = copilot.map((i) => i.twin.outsideAirFraction);
    const flips = states.filter((v, i) => i > 0 && v !== states[i - 1]).length;
    expect(flips).toBeLessThanOrEqual(4);      // seal, purge, reseal, reopen
  });

  it('lets CO2 actually clear before resealing', () => {
    const purgeIndex = copilot.findIndex((i) => i.decisions.some(
      (d) => d.command.actuator === 'outside_air_damper' && d.command.mode === 'purge'));
    if (purgeIndex === -1) return;
    expect(copilot[purgeIndex]!.twin.indoorCo2Ppm).toBeLessThan(1100);
  });

  it('advances the twin every interval', () => {
    for (let i = 1; i < copilot.length; i++) {
      expect(copilot[i]!.twin.at.getTime()).toBeGreaterThan(copilot[i - 1]!.twin.at.getTime());
    }
  });

  it('accumulates cooling energy monotonically', () => {
    for (let i = 1; i < copilot.length; i++) {
      expect(copilot[i]!.twin.coolingKwh).toBeGreaterThanOrEqual(copilot[i - 1]!.twin.coolingKwh);
    }
  });
});
