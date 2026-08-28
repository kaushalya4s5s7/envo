import { describe, expect, it } from 'bun:test';
import { AIR, COMFORT } from '../src/utils';
import { guardProposal, type GuardContext } from '../src/agent/guard';

const ctx = (over: Partial<GuardContext> = {}): GuardContext => ({
  sealed: false,
  indoorCo2Ppm: 700,
  changesThisHour: 0,
  ...over,
});

describe('the guard admits sound proposals', () => {
  it('accepts a setpoint inside the comfort band', () => {
    const r = guardProposal({ actuator: 'hvac_setpoint', setpointF: 74, rampMin: 90 }, ctx());
    expect(r.accepted).toBe(true);
  });

  it('accepts a damper move while the air is clean', () => {
    const r = guardProposal(
      { actuator: 'outside_air_damper', outsideAirFraction: 0.2, mode: 'economizer', highMerv: false },
      ctx(),
    );
    expect(r.accepted).toBe(true);
  });
});

describe('the guard rejects unsound proposals', () => {
  it('rejects malformed output that is not a valid command', () => {
    const r = guardProposal({ actuator: 'teleport', setpointF: 74 }, ctx());
    expect(r.accepted).toBe(false);
    expect(r.reason).toMatch(/contract/i);
  });

  it('rejects a setpoint below the comfort floor', () => {
    const r = guardProposal(
      { actuator: 'hvac_setpoint', setpointF: COMFORT.T_MIN_F - 5, rampMin: 90 }, ctx());
    expect(r.accepted).toBe(false);
    expect(r.reason).toMatch(/comfort/i);
  });

  it('rejects a setpoint above the comfort ceiling', () => {
    const r = guardProposal(
      { actuator: 'hvac_setpoint', setpointF: COMFORT.T_MAX_F + 5, rampMin: 90 }, ctx());
    expect(r.accepted).toBe(false);
  });

  /**
   * arbitration.md rule 1: health outranks energy. A model that proposes opening
   * the intake during an air quality event is proposing the one thing the rails
   * exist to prevent.
   */
  it('rejects opening the intake while an air quality event is active', () => {
    const r = guardProposal(
      { actuator: 'outside_air_damper', outsideAirFraction: 0.9, mode: 'economizer', highMerv: false },
      ctx({ sealed: true }),
    );
    expect(r.accepted).toBe(false);
    expect(r.reason).toMatch(/health|air quality/i);
  });

  it('still allows the CO2 purge while sealed, because that is a health action too', () => {
    const r = guardProposal(
      { actuator: 'outside_air_damper', outsideAirFraction: 0.5, mode: 'purge', highMerv: true },
      ctx({ sealed: true, indoorCo2Ppm: AIR.CO2_HARD_PPM }),
    );
    expect(r.accepted).toBe(true);
  });

  it('rejects a purge dressed up as economizing', () => {
    const r = guardProposal(
      { actuator: 'outside_air_damper', outsideAirFraction: 0.5, mode: 'economizer', highMerv: true },
      ctx({ sealed: true, indoorCo2Ppm: AIR.CO2_HARD_PPM }),
    );
    expect(r.accepted).toBe(false);
  });

  it('rejects a move that would breach the change budget', () => {
    const r = guardProposal(
      { actuator: 'hvac_setpoint', setpointF: 74, rampMin: 90 },
      ctx({ changesThisHour: 4 }),
    );
    expect(r.accepted).toBe(false);
    expect(r.reason).toMatch(/rate|budget/i);
  });
});

describe('every rejection explains itself', () => {
  it('names the rail that refused, for the audit log', () => {
    const r = guardProposal({ actuator: 'hvac_setpoint', setpointF: 40, rampMin: 90 }, ctx());
    expect(r.accepted).toBe(false);
    expect(r.reason.length).toBeGreaterThan(20);
    expect(r.rail).toBeTruthy();
  });
});
