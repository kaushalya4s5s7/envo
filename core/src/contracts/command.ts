import { z } from 'zod';

export const Actuator = z.enum([
  'hvac_setpoint',
  'facade_tint',
  'outside_air_damper',
  'demand_response',
]);
export type Actuator = z.infer<typeof Actuator>;

export const PolicyName = z.enum(['precool', 'tint', 'air_quality', 'demand_response']);
export type PolicyName = z.infer<typeof PolicyName>;

export const Command = z.discriminatedUnion('actuator', [
  z.object({
    actuator: z.literal('hvac_setpoint'),
    /** Zone setpoint, °F. */
    setpointF: z.number(),
    /** Ramp the change over this many minutes rather than stepping. */
    rampMin: z.number().nonnegative(),
  }),
  z.object({
    actuator: z.literal('facade_tint'),
    facadeId: z.string().min(1),
    level: z.enum(['clear', 'medium', 'dark']),
  }),
  z.object({
    actuator: z.literal('outside_air_damper'),
    /** Desired outside air fraction, 0..1. The BMS executes it inside its own interlocks. */
    outsideAirFraction: z.number().min(0).max(1),
    mode: z.enum(['economizer', 'recirculate', 'purge']),
    highMerv: z.boolean(),
  }),
  z.object({
    actuator: z.literal('demand_response'),
    participating: z.boolean(),
    shedKw: z.number().nonnegative(),
  }),
]);
export type Command = z.infer<typeof Command>;

/**
 * What a policy returns. Policies propose; they never actuate and never resolve
 * conflicts. The arbiter turns proposals into commands.
 */
export const Proposal = z.object({
  policy: PolicyName,
  command: Command,
  /** Arbitration class. See docs/decisions/product/arbitration.md. */
  priority: z.enum(['health', 'comfort', 'energy']),
  trigger: z.object({
    parameter: z.string().min(1),
    observed: z.number(),
    threshold: z.number(),
    sustainedIntervals: z.number().int().nonnegative(),
  }),
  /** Plain language. Never empty; an empty rationale fails the suite. */
  rationale: z.string().min(1),
});
export type Proposal = z.infer<typeof Proposal>;
