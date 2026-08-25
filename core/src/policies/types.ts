import type { Building, EnvSnapshot, Proposal } from '../contracts';
import type { ActuatorState } from '../bms';
import { initialLatch, type LatchState } from '../utils';

/**
 * Everything a policy is allowed to see.
 *
 * Policies are **pure**: same context in, same proposals out. No I/O, no clock
 * reads, no actuation, no conflict resolution. Latch state travels in and out
 * rather than being mutated, so a policy stays a function.
 */
export interface PolicyContext {
  at: Date;
  building: Building;
  env: EnvSnapshot;
  /** Modeled indoor conditions from the twin. Never measured. */
  indoor: { pm25: number; co2Ppm: number; zoneTempF: number };
  /** What the BMS reports right now, not what was last requested. */
  actuators: ActuatorState;
  latches: LatchMap;
}

export type LatchMap = Readonly<Record<string, LatchState>>;

export const emptyLatches = (): LatchMap => ({});

export const latchFor = (latches: LatchMap, key: string): LatchState =>
  latches[key] ?? initialLatch;

export interface PolicyResult<S = unknown> {
  proposals: Proposal[];
  /**
   * **A delta, not the whole map.** Only the latch keys this policy owns.
   *
   * Returning the full incoming map means a later policy in the merge order
   * overwrites an earlier policy's advanced latch with its stale copy, and the
   * latch silently never engages. Policies that hold no latches return `{}`.
   */
  latches: LatchMap;
  /** Policy owned state, surfaced so the arbiter and the UI can explain a decision. */
  state: S;
}
