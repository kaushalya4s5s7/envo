import type { DecisionRecord, EnvSnapshot, Proposal } from '../contracts';
import { AIR, COMFORT } from '../utils';

/**
 * Prompt construction. Pure and provider agnostic — no SDK import, no network.
 *
 * The model is asked to arbitrate, not to invent physics. It receives the
 * proposals the deterministic policies already produced, the conditions that
 * produced them, and the rails its answer will be checked against. Telling it
 * the rails up front is deliberate: a model that knows the constraint usually
 * respects it, and when it does not, the guard catches it and we show that.
 */

export interface ArbitrationBrief {
  at: Date;
  env: EnvSnapshot;
  indoor: { pm25: number; co2Ppm: number; zoneTempF: number };
  proposals: Proposal[];
  sealed: boolean;
}

/**
 * JSON Schema for the model's reply.
 *
 * **Flat, with every field required.** Gemini's schema support is an OpenAPI
 * subset and does not reliably express our discriminated `Command` union, so the
 * model fills all fields and `normalizeAgentCommand` selects the ones that belong
 * to the chosen actuator.
 *
 * The first live run rejected 7 of 7 proposals because this schema required only
 * `actuator` while the zod contract required `rampMin` and `highMerv` too. The
 * model was faithful to the schema; the schema was wrong. Keep the two in step —
 * there is a test that fails if they drift.
 */
export const ARBITRATION_SCHEMA = {
  type: 'object',
  properties: {
    command: {
      type: 'object',
      properties: {
        actuator: { type: 'string', enum: ['hvac_setpoint', 'outside_air_damper'] },
        setpointF: { type: 'number', description: 'Zone setpoint °F. Used only for hvac_setpoint.' },
        rampMin: { type: 'number', description: 'Minutes to ramp over. Used only for hvac_setpoint.' },
        outsideAirFraction: { type: 'number', description: '0 to 1. Used only for outside_air_damper.' },
        mode: { type: 'string', enum: ['economizer', 'recirculate', 'purge'],
                description: 'Used only for outside_air_damper.' },
        highMerv: { type: 'boolean', description: 'Denser filtration. Used only for outside_air_damper.' },
      },
      required: ['actuator', 'setpointF', 'rampMin', 'outsideAirFraction', 'mode', 'highMerv'],
    },
    rationale: { type: 'string' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
  required: ['command', 'rationale', 'confidence'],
} as const;

/**
 * Select the fields belonging to the chosen actuator.
 *
 * This adapts the **wire shape** only. It never repairs a value: an out of band
 * setpoint passes through untouched so the comfort rail refuses it, and an
 * unknown actuator is returned as-is so the contract rail refuses it.
 */
export function normalizeAgentCommand(flat: unknown): unknown {
  const c = flat as Record<string, unknown>;
  switch (c?.['actuator']) {
    case 'hvac_setpoint':
      return { actuator: 'hvac_setpoint', setpointF: c['setpointF'], rampMin: c['rampMin'] };
    case 'outside_air_damper':
      return {
        actuator: 'outside_air_damper',
        outsideAirFraction: c['outsideAirFraction'],
        mode: c['mode'],
        highMerv: c['highMerv'],
      };
    default:
      return flat;
  }
}

export function buildArbitrationPrompt(brief: ArbitrationBrief): string {
  const proposals = brief.proposals
    .map((p, i) => `  ${i + 1}. [${p.priority}] ${p.policy} → ${p.command.actuator}\n` +
      `     trigger: ${p.trigger.parameter} = ${p.trigger.observed.toFixed(1)} ` +
      `against threshold ${p.trigger.threshold}\n` +
      `     reasoning: ${p.rationale}`)
    .join('\n');

  return `You are arbitrating between control proposals for one commercial building.

CONDITIONS AT ${brief.at.toISOString()}
  outdoor apparent temperature   ${brief.env.now.apparentTempF.toFixed(1)} °F
  outdoor wet bulb               ${brief.env.now.wetBulbF.toFixed(1)} °F
  PM2.5 air quality index        ${brief.env.now.pm25Aqi.toFixed(0)}
  ozone air quality index        ${brief.env.now.ozoneAqi.toFixed(0)}
  cloud cover                    ${brief.env.now.cloudCoverPercent.toFixed(0)}%
  indoor zone temperature        ${brief.indoor.zoneTempF.toFixed(1)} °F
  indoor CO2                     ${brief.indoor.co2Ppm.toFixed(0)} ppm
  air quality event active       ${brief.sealed ? 'yes, intake is reduced' : 'no'}

COMPETING PROPOSALS
${proposals || '  (none)'}

CONSTRAINTS YOUR ANSWER WILL BE CHECKED AGAINST
  Health outranks energy. During an air quality event the intake may only be
  opened for a CO2 purge above ${AIR.CO2_CEILING_PPM} ppm, never to chase free cooling.
  Zone setpoint must stay within ${COMFORT.T_MIN_F} to ${COMFORT.T_MAX_F} °F during occupancy.
  An actuator may move at most a few times per hour.

Choose exactly one command. Explain it in two or three sentences an operator
would accept, naming the parameter that drove the decision and what the decision
costs. If the proposals do not conflict, pick the one that matters most now.`;
}

/** Explanation prompt: turn the audit trail into something an operator reads. */
export function buildExplanationPrompt(decisions: DecisionRecord[], date: string): string {
  const log = decisions
    .map((d) => `  ${d.at.toISOString().slice(11, 16)}  ${d.policy} → ${d.command.actuator}\n` +
      `    ${d.trigger.parameter} ${d.trigger.observed.toFixed(1)} vs ${d.trigger.threshold}\n` +
      `    reverses when: ${d.reverseWhen}`)
    .join('\n');

  return `Summarise this building's day for the operator who was not watching.

DATE ${date}
DECISIONS TAKEN
${log || '  (none)'}

Write three or four sentences. Lead with what happened and why it mattered.
Name the specific readings that drove each decision. Do not claim any figure was
measured — every indoor number here is modeled by a simulator. Do not invent
readings that are not listed above.`;
}
