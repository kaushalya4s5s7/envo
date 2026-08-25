import { describe, expect, it } from 'bun:test';
import type { Command } from '../src/contracts';
import { MAX_CHANGES_PER_HOUR } from '../src/utils';
import { SimulatedBms, verify } from '../src/bms';

const at = (h: number, m = 0) => new Date(Date.UTC(2026, 6, 18, h, m));

const damper = (fraction: number): Command =>
  ({ actuator: 'outside_air_damper', outsideAirFraction: fraction, mode: 'economizer', highMerv: false });
const setpoint = (f: number): Command => ({ actuator: 'hvac_setpoint', setpointF: f, rampMin: 90 });

describe('SimulatedBms', () => {
  it('applies a command and reports the resulting state', () => {
    const bms = new SimulatedBms();
    const result = bms.apply(damper(0.4), at(11));
    expect(result.accepted).toBe(true);
    expect(bms.state().outsideAirFraction).toBeCloseTo(0.4, 5);
  });

  it('tracks each actuator independently', () => {
    const bms = new SimulatedBms();
    bms.apply(damper(0), at(11));
    bms.apply(setpoint(70), at(11));
    expect(bms.state().outsideAirFraction).toBe(0);
    expect(bms.state().setpointF).toBe(70);
  });

  it('ignores a command that asks for the state it is already in', () => {
    const bms = new SimulatedBms();
    bms.apply(damper(0.4), at(11));
    const repeat = bms.apply(damper(0.4), at(11, 30));
    expect(repeat.accepted).toBe(false);
    expect(repeat.reason).toBe('no_change');
  });
});

describe('rate limiting', () => {
  it(`accepts up to ${MAX_CHANGES_PER_HOUR} changes per actuator in an hour`, () => {
    const bms = new SimulatedBms();
    for (let i = 0; i < MAX_CHANGES_PER_HOUR; i++) {
      expect(bms.apply(damper(0.1 * (i + 1)), at(11, i * 5)).accepted).toBe(true);
    }
  });

  it('drops the change that exceeds the budget, and says why', () => {
    const bms = new SimulatedBms();
    for (let i = 0; i < MAX_CHANGES_PER_HOUR; i++) bms.apply(damper(0.1 * (i + 1)), at(11, i * 5));
    const dropped = bms.apply(damper(0.9), at(11, 55));
    expect(dropped.accepted).toBe(false);
    expect(dropped.reason).toBe('rate_limited');
    expect(bms.state().outsideAirFraction).toBeCloseTo(0.4, 5);   // unchanged
  });

  it('budgets each actuator separately', () => {
    const bms = new SimulatedBms();
    for (let i = 0; i < MAX_CHANGES_PER_HOUR; i++) bms.apply(damper(0.1 * (i + 1)), at(11, i * 5));
    expect(bms.apply(setpoint(69), at(11, 55)).accepted).toBe(true);
  });

  it('recovers the budget once the hour has rolled', () => {
    const bms = new SimulatedBms();
    for (let i = 0; i < MAX_CHANGES_PER_HOUR; i++) bms.apply(damper(0.1 * (i + 1)), at(11, i * 5));
    expect(bms.apply(damper(0.9), at(12, 30)).accepted).toBe(true);
  });
});

describe('verify', () => {
  it('reports no divergence when the state matches the intent', () => {
    const bms = new SimulatedBms();
    bms.apply(damper(0), at(11));
    expect(verify(damper(0), bms.state())).toBeNull();
  });

  /**
   * honesty-rails.md rail 4: a damper command on a control screen does not prove
   * the blades moved. Trivially true in simulation; built anyway.
   */
  it('reports divergence when the actuator did not move', () => {
    const bms = new SimulatedBms();
    for (let i = 0; i < MAX_CHANGES_PER_HOUR; i++) bms.apply(damper(0.1 * (i + 1)), at(11, i * 5));
    bms.apply(damper(0), at(11, 55));                      // rate limited away
    const divergence = verify(damper(0), bms.state());
    expect(divergence).not.toBeNull();
    expect(divergence!.actuator).toBe('outside_air_damper');
    expect(divergence!.intended).toBe(0);
    expect(divergence!.observed).toBeCloseTo(0.4, 5);
  });
});
