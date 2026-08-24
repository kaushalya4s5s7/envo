import { z } from 'zod';
import { Command, PolicyName } from './command';

/**
 * The audit trail. Every command carries one, populated.
 *
 * This is what turns a threshold script into an agent, and it is what a judge
 * reads on screen. An empty `rationale` is a test failure, not a warning.
 */
export const DecisionRecord = z.object({
  at: z.coerce.date(),
  buildingId: z.string().min(1),
  segmentId: z.string().min(1),
  command: Command,
  policy: PolicyName,
  trigger: z.object({
    parameter: z.string().min(1),
    observed: z.number(),
    threshold: z.number(),
    sustainedIntervals: z.number().int().nonnegative(),
  }),
  /** Policies whose proposals lost, so the tradeoff is visible rather than hidden. */
  conflictsOverridden: z.array(PolicyName),
  /** What this decision costs, so it is never presented as free. */
  cost: z.record(z.string(), z.number()),
  benefit: z.record(z.string(), z.number()),
  rationale: z.string().min(1),
  /** Condition under which this decision reverses. */
  reverseWhen: z.string().min(1),
});
export type DecisionRecord = z.infer<typeof DecisionRecord>;

export const TwinState = z.object({
  at: z.coerce.date(),
  zoneTempF: z.number(),
  /**
   * Temperature of the building's thermal mass, °F. Lags the zone heavily.
   * When it sits below the zone it absorbs load, which is the mechanism that
   * makes pre cooling worth anything at all.
   */
  massTempF: z.number(),
  indoorPm25: z.number().nonnegative(),
  indoorCo2Ppm: z.number().nonnegative(),
  outsideAirFraction: z.number().min(0).max(1),
  /** Cumulative modeled cooling energy, kWh. Modeled, never metered. */
  coolingKwh: z.number().nonnegative(),
});
export type TwinState = z.infer<typeof TwinState>;

export const StrategyName = z.enum(['envelope_copilot', 'baseline']);
export type StrategyName = z.infer<typeof StrategyName>;

export const RunInterval = z.object({
  at: z.coerce.date(),
  commands: z.array(Command),
  decisions: z.array(DecisionRecord),
  twin: TwinState,
});
export type RunInterval = z.infer<typeof RunInterval>;

export const RunArtifact = z.object({
  fixtureId: z.string().min(1),
  buildingId: z.string().min(1),
  /**
   * True when any part of the fixture was generated rather than captured.
   * The UI must surface this. docs/decisions/platform/determinism.md.
   */
  synthetic: z.boolean(),
  generatedAt: z.coerce.date(),
  /** Snapshot of the thresholds this run used, so a run stays interpretable later. */
  thresholds: z.record(z.string(), z.unknown()),
  strategies: z.record(StrategyName, z.array(RunInterval)),
});
export type RunArtifact = z.infer<typeof RunArtifact>;
