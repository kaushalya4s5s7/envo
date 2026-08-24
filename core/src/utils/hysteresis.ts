/**
 * Hysteresis and persistence.
 *
 * Every threshold in this system has a separate open and close value, and every
 * trigger requires a sustained run rather than a single sample. Without both, a
 * signal oscillating near a boundary makes the actuator chatter, which is
 * immediately visible and immediately disqualifying.
 *
 * docs/decisions/product/honesty-rails.md rails 1 and 2.
 */

export type Latch = 'engaged' | 'released';

export interface HysteresisSpec {
  /** Crossing at or above this engages the latch. */
  readonly engageAt: number;
  /** Crossing at or below this releases it. Must be below `engageAt`. */
  readonly releaseAt: number;
  /** Consecutive samples at or above `engageAt` required to engage. */
  readonly persistEngage: number;
  /** Consecutive samples at or below `releaseAt` required to release. */
  readonly persistRelease: number;
}

export interface LatchState {
  readonly latch: Latch;
  /** Consecutive samples currently supporting a state change. */
  readonly run: number;
}

export const initialLatch: LatchState = { latch: 'released', run: 0 };

/**
 * Advance the latch by one sample.
 *
 * Asymmetric by design: engaging is fast, releasing is slow. That encodes the
 * value judgement "protect on the way in, be sceptical on the way out".
 */
export function step(state: LatchState, value: number, spec: HysteresisSpec): LatchState {
  if (spec.releaseAt >= spec.engageAt) {
    throw new Error(`releaseAt (${spec.releaseAt}) must be below engageAt (${spec.engageAt})`);
  }

  if (state.latch === 'released') {
    const supports = value >= spec.engageAt;
    const run = supports ? state.run + 1 : 0;
    return run >= spec.persistEngage ? { latch: 'engaged', run: 0 } : { latch: 'released', run };
  }

  const supports = value <= spec.releaseAt;
  const run = supports ? state.run + 1 : 0;
  return run >= spec.persistRelease ? { latch: 'released', run: 0 } : { latch: 'engaged', run };
}

/** Run a whole series through the latch. Returns the state after each sample. */
export function trace(values: readonly number[], spec: HysteresisSpec): LatchState[] {
  const out: LatchState[] = [];
  let state = initialLatch;
  for (const v of values) {
    state = step(state, v, spec);
    out.push(state);
  }
  return out;
}

/** Index of the first sample at which the latch engages, or -1. */
export function firstEngagement(values: readonly number[], spec: HysteresisSpec): number {
  return trace(values, spec).findIndex((s) => s.latch === 'engaged');
}

/** How many times the latch changed state. A proxy for chatter. */
export function transitionCount(values: readonly number[], spec: HysteresisSpec): number {
  let previous: Latch = 'released';
  let count = 0;
  for (const s of trace(values, spec)) {
    if (s.latch !== previous) count++;
    previous = s.latch;
  }
  return count;
}
