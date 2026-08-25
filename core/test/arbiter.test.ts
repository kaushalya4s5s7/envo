import { describe, expect, it } from 'bun:test';
import type { Proposal } from '../src/contracts';
import { arbitrate } from '../src/copilot';

const at = new Date('2026-07-18T15:00:00Z');

const seal: Proposal = {
  policy: 'air_quality',
  command: { actuator: 'outside_air_damper', outsideAirFraction: 0, mode: 'recirculate', highMerv: true },
  priority: 'health',
  trigger: { parameter: 'pm25Aqi', observed: 171, threshold: 151, sustainedIntervals: 2 },
  rationale: 'Sustained particulate load above the Unhealthy breakpoint on this segment.',
};

const freeCool: Proposal = {
  policy: 'precool',
  command: { actuator: 'outside_air_damper', outsideAirFraction: 0.9, mode: 'economizer', highMerv: false },
  priority: 'energy',
  trigger: { parameter: 'wetBulbF', observed: 58, threshold: 65, sustainedIntervals: 1 },
  rationale: 'Wet bulb is low enough to cool the building on outside air alone.',
};

const setpoint: Proposal = {
  policy: 'precool',
  command: { actuator: 'hvac_setpoint', setpointF: 70, rampMin: 90 },
  priority: 'energy',
  trigger: { parameter: 'apparentTempF', observed: 103, threshold: 95, sustainedIntervals: 1 },
  rationale: 'Apparent temperature is forecast to peak this afternoon.',
};

const tint: Proposal = {
  policy: 'tint',
  command: { actuator: 'facade_tint', facadeId: 'west', level: 'dark' },
  priority: 'energy',
  trigger: { parameter: 'beamOnFacade:west', observed: 612, threshold: 500, sustainedIntervals: 1 },
  rationale: 'Direct beam on the west facade exceeds the tint threshold.',
};

const ctx = { at, buildingId: 'demo-nyc-001', segmentId: 'seg_x' };

describe('arbitration', () => {
  it('emits one command per actuator', () => {
    const { commands } = arbitrate([seal, freeCool, setpoint, tint], ctx);
    const actuators = commands.map((c) => c.actuator);
    expect(new Set(actuators).size).toBe(actuators.length);
  });

  /** arbitration.md priority 1: health beats energy on the same actuator, always. */
  it('lets health win the damper over free cooling', () => {
    const { commands } = arbitrate([freeCool, seal], ctx);
    const damper = commands.find((c) => c.actuator === 'outside_air_damper')!;
    if (damper.actuator !== 'outside_air_damper') throw new Error('wrong actuator');
    expect(damper.outsideAirFraction).toBe(0);
    expect(damper.mode).toBe('recirculate');
  });

  it('wins regardless of the order proposals arrive in', () => {
    const forward = arbitrate([seal, freeCool], ctx).commands;
    const reverse = arbitrate([freeCool, seal], ctx).commands;
    expect(forward).toEqual(reverse);
  });

  it('leaves non conflicting energy decisions untouched', () => {
    const { commands } = arbitrate([seal, freeCool, setpoint, tint], ctx);
    expect(commands.some((c) => c.actuator === 'hvac_setpoint')).toBe(true);
    expect(commands.some((c) => c.actuator === 'facade_tint')).toBe(true);
  });

  it('records the losing policy so the tradeoff is visible, not hidden', () => {
    const { decisions } = arbitrate([freeCool, seal], ctx);
    const damper = decisions.find((d) => d.command.actuator === 'outside_air_damper')!;
    expect(damper.policy).toBe('air_quality');
    expect(damper.conflictsOverridden).toContain('precool');
  });

  it('does not claim a conflict when there was none', () => {
    const { decisions } = arbitrate([tint], ctx);
    expect(decisions[0]!.conflictsOverridden).toHaveLength(0);
  });
});

describe('the decision record', () => {
  it('carries a populated rationale for every command', () => {
    const { decisions } = arbitrate([seal, setpoint, tint], ctx);
    expect(decisions).toHaveLength(3);
    for (const d of decisions) {
      expect(d.rationale.length).toBeGreaterThan(0);
      expect(d.reverseWhen.length).toBeGreaterThan(0);
    }
  });

  it('emits exactly one record per command', () => {
    const { commands, decisions } = arbitrate([seal, freeCool, setpoint, tint], ctx);
    expect(decisions).toHaveLength(commands.length);
  });

  it('states the cost when health overrides energy, rather than presenting it as free', () => {
    const { decisions } = arbitrate([freeCool, seal], ctx);
    const damper = decisions.find((d) => d.command.actuator === 'outside_air_damper')!;
    expect(Object.keys(damper.cost).length).toBeGreaterThan(0);
  });

  it('binds every record to the building and segment that produced it', () => {
    const { decisions } = arbitrate([seal], ctx);
    expect(decisions[0]!.buildingId).toBe('demo-nyc-001');
    expect(decisions[0]!.segmentId).toBe('seg_x');
    expect(decisions[0]!.at.toISOString()).toBe(at.toISOString());
  });

  it('produces nothing from no proposals', () => {
    const { commands, decisions } = arbitrate([], ctx);
    expect(commands).toHaveLength(0);
    expect(decisions).toHaveLength(0);
  });
});
