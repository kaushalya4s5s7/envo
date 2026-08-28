import { Command } from '../contracts';
import { AIR, COMFORT, MAX_CHANGES_PER_HOUR } from '../utils';

/**
 * The rails an LLM proposal must pass before it can touch a building.
 *
 * **Provider agnostic on purpose.** This file knows nothing about which model
 * produced the proposal. Swapping the model, or removing the model entirely,
 * changes nothing here — the guarantees belong to the building, not the vendor.
 *
 * Every rule traces to docs/decisions/product/arbitration.md or honesty-rails.md.
 * A rejection is not a failure of the demo: it is the demo.
 */

export interface GuardContext {
  /** An air quality event is active — the intake is being held down. */
  sealed: boolean;
  indoorCo2Ppm: number;
  /** Changes already spent on this actuator in the current hour. */
  changesThisHour: number;
}

export type Rail =
  | 'contract'
  | 'comfort_bounds'
  | 'health_priority'
  | 'rate_limit';

export type GuardResult =
  | { accepted: true; command: Command }
  | { accepted: false; rail: Rail; reason: string };

export function guardProposal(candidate: unknown, ctx: GuardContext): GuardResult {
  // 1. Contract. Anything the schema does not recognise never reaches a building.
  const parsed = Command.safeParse(candidate);
  if (!parsed.success) {
    return {
      accepted: false,
      rail: 'contract',
      reason: `The proposal failed contract validation and was discarded before any rail ran: ` +
        `${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`,
    };
  }
  const command = parsed.data;

  // 2. Rate limit. Operators distrust systems that move constantly.
  if (ctx.changesThisHour >= MAX_CHANGES_PER_HOUR) {
    return {
      accepted: false,
      rail: 'rate_limit',
      reason: `This actuator has already moved ${ctx.changesThisHour} times this hour, at the ` +
        `budget of ${MAX_CHANGES_PER_HOUR}. The proposal is refused to stop the actuator thrashing.`,
    };
  }

  // 3. Comfort bounds. Energy decisions optimize inside these, never through them.
  if (command.actuator === 'hvac_setpoint') {
    if (command.setpointF < COMFORT.T_MIN_F || command.setpointF > COMFORT.T_MAX_F) {
      return {
        accepted: false,
        rail: 'comfort_bounds',
        reason: `A setpoint of ${command.setpointF} °F falls outside the occupied comfort band of ` +
          `${COMFORT.T_MIN_F} to ${COMFORT.T_MAX_F} °F. Comfort bounds are a hard constraint that ` +
          `energy optimisation is not permitted to trade away.`,
      };
    }
  }

  // 4. Health priority. During an air quality event the intake may only move for
  //    a health reason — a CO₂ purge — never to chase free cooling.
  if (command.actuator === 'outside_air_damper' && ctx.sealed) {
    const raisingIntake = command.outsideAirFraction > AIR.SEAL_OA_FRACTION;
    const isPurge = command.mode === 'purge' && ctx.indoorCo2Ppm >= AIR.CO2_CEILING_PPM;
    if (raisingIntake && !isPurge) {
      return {
        accepted: false,
        rail: 'health_priority',
        reason: `Raising outside air to ${(command.outsideAirFraction * 100).toFixed(0)}% during an ` +
          `active air quality event is refused. Health outranks energy, and the only permitted ` +
          `reason to open the intake here is a CO₂ purge above ${AIR.CO2_CEILING_PPM} ppm ` +
          `(indoor CO₂ is ${ctx.indoorCo2Ppm.toFixed(0)} ppm, mode is "${command.mode}").`,
      };
    }
  }

  return { accepted: true, command };
}
