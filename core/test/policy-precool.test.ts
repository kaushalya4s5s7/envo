import { describe, expect, it } from 'bun:test';
import type { EnvReading, EnvSnapshot } from '../src/contracts';
import { demoBuilding } from '../src/building';
import { COMFORT, PRECOOL } from '../src/utils';
import { emptyLatches, precoolPolicy, type PolicyContext } from '../src/policies';

const reading = (apparentTempF: number, at = new Date('2026-07-18T15:00:00Z')): EnvReading =>
  ({ at, apparentTempF, wetBulbF: 72, pm25Aqi: 40, ozoneAqi: 30, cloudCoverPercent: 24 });

const env = (nowF: number, forecastF: number[]): EnvSnapshot => ({
  segmentId: demoBuilding.segmentId,
  timezone: 'America/New_York',
  intervalMin: 60,
  now: reading(nowF),
  forecast: forecastF.map((f, i) => reading(f, new Date(Date.UTC(2026, 6, 18, 16 + i)))),
  clearSky: { ghiWm2: 700, dniWm2: 400, dhiWm2: 120 },
});

const ctx = (nowF: number, forecastF: number[], over: Partial<PolicyContext> = {}): PolicyContext => ({
  at: new Date('2026-07-18T15:00:00Z'),
  building: demoBuilding,
  env: env(nowF, forecastF),
  indoor: { pm25: 6, co2Ppm: 600, zoneTempF: 72 },
  actuators: { outsideAirFraction: 0.2, setpointF: 72, tint: {}, demandResponse: false },
  latches: emptyLatches(),
  ...over,
});

const HOT = PRECOOL.TRIGGER_F + 8;
const MILD = 80;

describe('pre cooling', () => {
  it('proposes nothing when no peak is forecast', () => {
    expect(precoolPolicy(ctx(MILD, [MILD, MILD, MILD])).proposals).toHaveLength(0);
  });

  it('lowers the setpoint ahead of a forecast peak', () => {
    const proposal = precoolPolicy(ctx(MILD, [MILD, HOT, HOT])).proposals[0]!;
    expect(proposal.command).toMatchObject({ actuator: 'hvac_setpoint' });
    if (proposal.command.actuator !== 'hvac_setpoint') throw new Error('wrong actuator');
    expect(proposal.command.setpointF).toBe(72 - PRECOOL.DELTA_F);
    expect(proposal.command.rampMin).toBe(PRECOOL.RAMP_MIN);
  });

  it('is an energy decision, not a health one', () => {
    expect(precoolPolicy(ctx(MILD, [HOT, HOT])).proposals[0]!.priority).toBe('energy');
  });

  /** Pre cooling during the peak is just cooling. The headroom check prevents it. */
  it('does not pre cool once the peak has already arrived', () => {
    expect(precoolPolicy(ctx(HOT, [HOT, HOT])).proposals).toHaveLength(0);
  });

  it('does not propose a setpoint below the comfort floor', () => {
    const cold = ctx(MILD, [HOT, HOT], {
      actuators: { outsideAirFraction: 0.2, setpointF: COMFORT.T_MIN_F, tint: {}, demandResponse: false },
    });
    expect(precoolPolicy(cold).proposals).toHaveLength(0);
  });

  it('does not repeat itself once the setpoint is already lowered', () => {
    const already = ctx(MILD, [HOT, HOT], {
      actuators: { outsideAirFraction: 0.2, setpointF: 72 - PRECOOL.DELTA_F, tint: {}, demandResponse: false },
    });
    expect(precoolPolicy(already).proposals).toHaveLength(0);
  });

  it('ignores a peak beyond the forecast horizon it can act on', () => {
    expect(precoolPolicy(ctx(MILD, [])).proposals).toHaveLength(0);
  });

  it('names the forecast peak and its hour in the rationale', () => {
    const proposal = precoolPolicy(ctx(MILD, [MILD, HOT])).proposals[0]!;
    expect(proposal.rationale).toContain(String(Math.round(HOT)));
    expect(proposal.trigger.parameter).toBe('apparentTempF');
    expect(proposal.trigger.observed).toBeCloseTo(HOT, 5);
  });
});

/**
 * Pre cooling is two phases, not one. Charging the mass and then holding the
 * lower setpoint through the peak is simply running cold all day, which costs
 * more than doing nothing. The saving comes from letting the zone float back up
 * during the peak and coasting on what was stored.
 *
 * The first implementation had only the charge phase, and against the real
 * 2026-08-07 capture it spent 239 kWh against the baseline's 233.
 */
describe('coasting through the peak', () => {
  const charged = (nowF: number, forecastF: number[]) => ctx(nowF, forecastF, {
    actuators: {
      outsideAirFraction: 0.2,
      setpointF: demoBuilding.nominalSetpointF - PRECOOL.DELTA_F,
      tint: {}, demandResponse: false,
    },
  });

  it('raises the setpoint once the peak has arrived', () => {
    const proposal = precoolPolicy(charged(HOT, [HOT])).proposals[0]!;
    if (proposal.command.actuator !== 'hvac_setpoint') throw new Error('wrong actuator');
    expect(proposal.command.setpointF).toBeGreaterThan(demoBuilding.nominalSetpointF);
  });

  it('never coasts past the comfort ceiling', () => {
    const proposal = precoolPolicy(charged(HOT, [HOT])).proposals[0]!;
    if (proposal.command.actuator !== 'hvac_setpoint') throw new Error('wrong actuator');
    expect(proposal.command.setpointF).toBeLessThanOrEqual(COMFORT.T_MAX_F);
  });

  it('does not coast if the building was never pre cooled', () => {
    const never = ctx(HOT, [HOT]);   // setpoint still at nominal
    expect(never.actuators.setpointF).toBe(demoBuilding.nominalSetpointF);
    expect(precoolPolicy(never).proposals).toHaveLength(0);
  });

  it('returns to the nominal setpoint once the peak has passed', () => {
    const after = ctx(MILD, [MILD], {
      actuators: {
        outsideAirFraction: 0.2, setpointF: COMFORT.T_MAX_F - 1, tint: {}, demandResponse: false,
      },
    });
    const proposal = precoolPolicy(after).proposals[0]!;
    if (proposal.command.actuator !== 'hvac_setpoint') throw new Error('wrong actuator');
    expect(proposal.command.setpointF).toBe(demoBuilding.nominalSetpointF);
  });

  it('reports which phase it is in', () => {
    expect(precoolPolicy(charged(HOT, [HOT])).state.phase).toBe('coast');
    expect(precoolPolicy(ctx(MILD, [HOT, HOT])).state.phase).toBe('charge');
    expect(precoolPolicy(ctx(MILD, [MILD])).state.phase).toBe('idle');
  });
});
