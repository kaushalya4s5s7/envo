import { describe, expect, it } from 'bun:test';
import type { EnvSnapshot, Proposal } from '../src/contracts';
import { AIR, COMFORT } from '../src/utils';
import { Command } from '../src/contracts';
import { ARBITRATION_SCHEMA, buildArbitrationPrompt, normalizeAgentCommand } from '../src/agent/prompt';

const env: EnvSnapshot = {
  segmentId: 'seg_x', timezone: 'America/New_York', intervalMin: 60,
  now: { at: new Date('2026-08-07T23:00:00Z'), apparentTempF: 89.2, wetBulbF: 74.7,
         pm25Aqi: 62, ozoneAqi: 151, cloudCoverPercent: 83 },
  forecast: [], clearSky: { ghiWm2: 0, dniWm2: 0, dhiWm2: 0 },
};

const proposal: Proposal = {
  policy: 'air_quality',
  command: { actuator: 'outside_air_damper', outsideAirFraction: 0.1, mode: 'recirculate', highMerv: true },
  priority: 'health',
  trigger: { parameter: 'ozoneAqi', observed: 151, threshold: 151, sustainedIntervals: 1 },
  rationale: 'Ozone reached the Unhealthy breakpoint.',
};

const brief = {
  at: new Date('2026-08-07T23:00:00Z'), env,
  indoor: { pm25: 6, co2Ppm: 1180, zoneTempF: 72 },
  proposals: [proposal], sealed: true,
};

describe('the arbitration prompt', () => {
  it('states the conditions the decision rests on', () => {
    const p = buildArbitrationPrompt(brief);
    expect(p).toContain('151');            // the ozone reading
    expect(p).toContain('1180');           // indoor CO2
    expect(p).toContain('89.2');           // apparent temperature
  });

  it('lists every competing proposal with its priority', () => {
    const p = buildArbitrationPrompt(brief);
    expect(p).toContain('air_quality');
    expect(p).toContain('[health]');
  });

  /** A model told the constraint usually respects it. The guard catches the rest. */
  it('tells the model the rails its answer will be checked against', () => {
    const p = buildArbitrationPrompt(brief);
    expect(p).toContain(String(AIR.CO2_CEILING_PPM));
    expect(p).toContain(String(COMFORT.T_MIN_F));
    expect(p).toContain(String(COMFORT.T_MAX_F));
    expect(p).toMatch(/health outranks energy/i);
  });

  it('survives having no proposals to arbitrate', () => {
    expect(buildArbitrationPrompt({ ...brief, proposals: [] })).toContain('(none)');
  });

  it('never asks the model to invent a measurement', () => {
    expect(buildArbitrationPrompt(brief)).not.toMatch(/estimate the|guess the/i);
  });
});

describe('the response schema', () => {
  it('constrains the actuator to ones we can actually drive', () => {
    const actuators = ARBITRATION_SCHEMA.properties.command.properties.actuator.enum;
    expect(actuators).toContain('outside_air_damper');
    expect(actuators).toContain('hvac_setpoint');
  });

  it('requires a rationale, so no command can arrive unexplained', () => {
    expect(ARBITRATION_SCHEMA.required).toContain('rationale');
  });
});

/**
 * The first live run rejected 7 of 7 proposals on the contract rail, every one
 * for a missing `rampMin` or `highMerv`. The model was faithful to the schema it
 * was given; the schema disagreed with the zod contract it would be judged by.
 * These tests pin the two together.
 */
describe('the schema agrees with the contract it will be judged by', () => {
  it('requires every field the Command union needs, not just the actuator', () => {
    const required = ARBITRATION_SCHEMA.required as readonly string[];
    const cmd = ARBITRATION_SCHEMA.properties.command.required as readonly string[];
    expect(required).toContain('command');
    for (const field of ['actuator', 'setpointF', 'rampMin', 'outsideAirFraction', 'mode', 'highMerv']) {
      expect(cmd).toContain(field);
    }
  });

  it('normalizes a flat reply into the setpoint variant the contract expects', () => {
    const c = normalizeAgentCommand({
      actuator: 'hvac_setpoint', setpointF: 74, rampMin: 90,
      outsideAirFraction: 0.2, mode: 'economizer', highMerv: false,
    });
    expect(Command.safeParse(c).success).toBe(true);
    expect(c).not.toHaveProperty('mode');
  });

  it('normalizes a flat reply into the damper variant', () => {
    const c = normalizeAgentCommand({
      actuator: 'outside_air_damper', setpointF: 72, rampMin: 90,
      outsideAirFraction: 0.1, mode: 'recirculate', highMerv: true,
    });
    expect(Command.safeParse(c).success).toBe(true);
    expect(c).not.toHaveProperty('setpointF');
  });

  /** Normalizing shape must never launder a bad value past the real rails. */
  it('passes an out of band setpoint straight through to be refused', () => {
    const c = normalizeAgentCommand({
      actuator: 'hvac_setpoint', setpointF: 740, rampMin: 90,
      outsideAirFraction: 0.2, mode: 'economizer', highMerv: false,
    });
    expect((c as { setpointF: number }).setpointF).toBe(740);
  });

  it('leaves an unknown actuator alone so the contract rail refuses it', () => {
    expect(Command.safeParse(normalizeAgentCommand({ actuator: 'teleport' })).success).toBe(false);
  });
});
