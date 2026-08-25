import type { Actuator, Command } from '../contracts';
import { MAX_CHANGES_PER_HOUR } from '../utils';

/**
 * The boundary between the agent and the building.
 *
 * We emit a **desired** state. A real BMS executes it inside its own pressure,
 * life safety, and fire interlocks, which this system does not model and must
 * not claim to. docs/decisions/product/honesty-rails.md rails 4 and 5.
 */

export interface ActuatorState {
  outsideAirFraction: number;
  setpointF: number;
  tint: Record<string, 'clear' | 'medium' | 'dark'>;
  demandResponse: boolean;
}

export type RejectionReason = 'no_change' | 'rate_limited';

export interface ApplyResult {
  accepted: boolean;
  reason?: RejectionReason;
}

export interface Divergence {
  actuator: Actuator;
  intended: number | string | boolean;
  observed: number | string | boolean;
}

/** Swappable behind a token so a real adapter drops in without touching a caller. */
export interface BmsAdapter {
  apply(command: Command, at: Date): ApplyResult;
  state(): ActuatorState;
}

const HOUR_MS = 3_600_000;

export class SimulatedBms implements BmsAdapter {
  #state: ActuatorState = {
    outsideAirFraction: 0.2,
    setpointF: 72,
    tint: {},
    demandResponse: false,
  };
  /** Timestamps of accepted changes, per actuator, for the rolling budget. */
  #history = new Map<Actuator, number[]>();

  state(): ActuatorState {
    return { ...this.#state, tint: { ...this.#state.tint } };
  }

  apply(command: Command, at: Date): ApplyResult {
    if (this.#alreadyInState(command)) return { accepted: false, reason: 'no_change' };

    const recent = (this.#history.get(command.actuator) ?? [])
      .filter((t) => at.getTime() - t < HOUR_MS);
    if (recent.length >= MAX_CHANGES_PER_HOUR) {
      this.#history.set(command.actuator, recent);
      return { accepted: false, reason: 'rate_limited' };
    }

    this.#commit(command);
    this.#history.set(command.actuator, [...recent, at.getTime()]);
    return { accepted: true };
  }

  #alreadyInState(command: Command): boolean {
    switch (command.actuator) {
      case 'outside_air_damper':
        return this.#state.outsideAirFraction === command.outsideAirFraction;
      case 'hvac_setpoint':
        return this.#state.setpointF === command.setpointF;
      case 'facade_tint':
        return this.#state.tint[command.facadeId] === command.level;
      case 'demand_response':
        return this.#state.demandResponse === command.participating;
    }
  }

  #commit(command: Command): void {
    switch (command.actuator) {
      case 'outside_air_damper':
        this.#state.outsideAirFraction = command.outsideAirFraction;
        return;
      case 'hvac_setpoint':
        this.#state.setpointF = command.setpointF;
        return;
      case 'facade_tint':
        this.#state.tint[command.facadeId] = command.level;
        return;
      case 'demand_response':
        this.#state.demandResponse = command.participating;
        return;
    }
  }
}

/**
 * Compare intent against observed state.
 *
 * A command shown on a control screen does not prove the blades moved. Returns
 * null when they agree, a Divergence when they do not.
 */
export function verify(command: Command, observed: ActuatorState): Divergence | null {
  const pair = (intended: number | string | boolean, seen: number | string | boolean) =>
    intended === seen ? null : { actuator: command.actuator, intended, observed: seen };

  switch (command.actuator) {
    case 'outside_air_damper':
      return pair(command.outsideAirFraction, observed.outsideAirFraction);
    case 'hvac_setpoint':
      return pair(command.setpointF, observed.setpointF);
    case 'facade_tint':
      return pair(command.level, observed.tint[command.facadeId] ?? 'clear');
    case 'demand_response':
      return pair(command.participating, observed.demandResponse);
  }
}
