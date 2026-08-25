import type { Proposal } from '../contracts';
import { AIR, co2CeilingPpm, step, type HysteresisSpec } from '../utils';

const CO2 = 'indoorCo2Ppm';
import { latchFor, type PolicyContext, type PolicyResult } from './types';

/**
 * Policy C — the air quality override.
 *
 * The one decision nobody automates: when a hyperlocal particulate or ozone
 * spike crosses this block, shut the intake, recirculate, and accept the cooling
 * penalty to protect the people inside.
 *
 * Thresholds are US AQI index, matching what FortyGuard returns. See
 * docs/decisions/product/thresholds.md.
 */

const PM25 = 'pm25Aqi';
const OZONE = 'ozoneAqi';

const SPEC: Record<string, HysteresisSpec> = {
  [PM25]: {
    engageAt: AIR.PM25_AQI_CLOSE,
    releaseAt: AIR.PM25_AQI_REOPEN,
    persistEngage: AIR.PERSIST_CLOSE,
    persistRelease: AIR.PERSIST_REOPEN,
  },
  [OZONE]: {
    engageAt: AIR.O3_AQI_CLOSE,
    releaseAt: AIR.O3_AQI_REOPEN,
    persistEngage: AIR.PERSIST_CLOSE,
    persistRelease: AIR.PERSIST_REOPEN,
  },
};

export interface AirQualityState {
  sealed: boolean;
  /** When the agent intends to flush CO₂, or null if no purge is pending. */
  purgePlannedFor: Date | null;
}

/** How far ahead to look for a cleaner window before giving up and purging now. */
const PURGE_LOOKAHEAD = 4;

/**
 * `overrides` exists for experiments only. Production always uses the values in
 * docs/decisions/product/thresholds.md; varying them is how we tell a tuning
 * problem apart from a policy bug.
 */
export function airQualityPolicy(
  ctx: PolicyContext,
  overrides: Partial<typeof AIR> = {},
): PolicyResult<AirQualityState> {
  const A = { ...AIR, ...overrides };
  const SPEC_LOCAL: Record<string, HysteresisSpec> = {
    [PM25]: { engageAt: A.PM25_AQI_CLOSE, releaseAt: A.PM25_AQI_REOPEN,
              persistEngage: A.PERSIST_CLOSE, persistRelease: A.PERSIST_REOPEN },
    [OZONE]: { engageAt: A.O3_AQI_CLOSE, releaseAt: A.O3_AQI_REOPEN,
               persistEngage: A.PERSIST_CLOSE, persistRelease: A.PERSIST_REOPEN },
  };
  const proposals: Proposal[] = [];
  // Delta only: the two latches this policy owns. See PolicyResult.latches.
  const latches: Record<string, ReturnType<typeof step>> = {};

  // Advance one latch per pollutant. Either one sealing the building is enough.
  let sealed = false;
  let cause: { parameter: string; observed: number; threshold: number; sustained: number } | null = null;

  for (const parameter of [PM25, OZONE]) {
    const observed = parameter === PM25 ? ctx.env.now.pm25Aqi : ctx.env.now.ozoneAqi;
    const next = step(latchFor(ctx.latches, parameter), observed, SPEC_LOCAL[parameter]!);
    latches[parameter] = next;
    if (next.latch === 'engaged') {
      sealed = true;
      cause ??= {
        parameter,
        observed,
        threshold: SPEC_LOCAL[parameter]!.engageAt,
        sustained: AIR.PERSIST_CLOSE,
      };
    }
  }

  /**
   * ASHRAE 62.1 sets this ceiling relative to outdoor air, so it is derived from
   * the measured outdoor concentration when FortyGuard supplies one and falls
   * back to the fixed constant when it does not.
   */
  const ceiling = co2CeilingPpm(ctx.env.now.outdoorCo2Ppm);

  // The purge latch. Engages at the ceiling, releases only once CO₂ has actually
  // cleared, so a flush runs long enough to be worth doing instead of flapping.
  const co2Spec: HysteresisSpec = {
    engageAt: ceiling,
    releaseAt: A.CO2_PURGE_CLEAR_PPM,
    persistEngage: 1,
    persistRelease: 1,
  };
  const pastHardLimit = ctx.indoor.co2Ppm >= A.CO2_HARD_PPM;
  const worst = (r: { pm25Aqi: number; ozoneAqi: number }) => Math.max(r.pm25Aqi, r.ozoneAqi);
  const window = ctx.env.forecast.slice(0, PURGE_LOOKAHEAD);
  const cleanest = window.reduce<{ at: Date; aqi: number } | null>(
    (best, r) => (best === null || worst(r) < best.aqi ? { at: r.at, aqi: worst(r) } : best),
    null,
  );
  const nowIsCleanest = cleanest === null || worst(ctx.env.now) <= cleanest.aqi;

  /*
   * Starting a purge and continuing one are different questions.
   *
   * The window search decides **when to begin**. Re-asking it every interval
   * made the flush stop as soon as CO₂ dipped under the hard limit, reseal, and
   * oscillate. Once engaged the latch runs until CO₂ has actually cleared.
   */
  const previous = latchFor(ctx.latches, CO2);
  const co2Latch = previous.latch === 'engaged'
    ? (ctx.indoor.co2Ppm <= co2Spec.releaseAt ? { latch: 'released' as const, run: 0 } : previous)
    : (ctx.indoor.co2Ppm >= co2Spec.engageAt && (pastHardLimit || nowIsCleanest)
        ? { latch: 'engaged' as const, run: 0 }
        : previous);
  latches[CO2] = co2Latch;

  const purging = sealed && co2Latch.latch === 'engaged';

  const alreadyShut = ctx.actuators.outsideAirFraction <= A.SEAL_OA_FRACTION;

  if (sealed && cause && !alreadyShut && !purging) {
    proposals.push({
      policy: 'air_quality',
      command: {
        actuator: 'outside_air_damper',
        outsideAirFraction: A.SEAL_OA_FRACTION,
        mode: 'recirculate',
        highMerv: true,
      },
      priority: 'health',
      trigger: {
        parameter: cause.parameter,
        observed: cause.observed,
        threshold: cause.threshold,
        sustainedIntervals: cause.sustained,
      },
      rationale:
        `${cause.parameter} reached AQI ${cause.observed.toFixed(0)} at this segment and held above ` +
        `${cause.threshold} for ${cause.sustained} intervals. Closing the outside air intake and ` +
        `cutting outside air to ${(A.SEAL_OA_FRACTION * 100).toFixed(0)}% and recirculating through ` +
        `denser filtration. Ventilation is reduced rather than stopped: shutting the intake entirely ` +
        `would trade this hazard for CO₂ buildup. The cooling energy cost is accepted to keep the ` +
        `pollutant load off the occupants.`,
    });
  }

  if (!sealed && alreadyShut) {
    // The latch has released after the sustained clean window. Hand the damper
    // back to economizer control rather than leaving the building sealed.
    proposals.push({
      policy: 'air_quality',
      command: {
        actuator: 'outside_air_damper',
        outsideAirFraction: A.NORMAL_OA_FRACTION,
        mode: 'economizer',
        highMerv: false,
      },
      priority: 'health',
      trigger: {
        parameter: PM25,
        observed: ctx.env.now.pm25Aqi,
        threshold: A.PM25_AQI_REOPEN,
        sustainedIntervals: A.PERSIST_REOPEN,
      },
      rationale:
        `Particulate and ozone indices have held at or below their reopen thresholds for ` +
        `${A.PERSIST_REOPEN} intervals, which is deliberately longer than the ${A.PERSIST_CLOSE} ` +
        `it took to close. Returning the intake to normal ventilation.`,
    });
  }

  // CO₂ escape hatch. Sealing protects lungs but stops diluting what people
  // exhale, so the agent must eventually let air in. It picks the least bad
  // moment, but "least bad" is not allowed to mean "never".
  let purgePlannedFor: Date | null = null;

  if (purging) {
    proposals.push({
      policy: 'air_quality',
      command: { actuator: 'outside_air_damper', outsideAirFraction: 0.5, mode: 'purge', highMerv: true },
      priority: 'health',
      trigger: {
        parameter: 'indoorCo2Ppm',
        observed: ctx.indoor.co2Ppm,
        threshold: pastHardLimit ? A.CO2_HARD_PPM : ceiling,
        sustainedIntervals: 1,
      },
      rationale: pastHardLimit
        ? `Indoor CO₂ reached ${ctx.indoor.co2Ppm.toFixed(0)} ppm, at or past the hard limit of ` +
          `${A.CO2_HARD_PPM}. Flushing now regardless of outdoor conditions: waiting for cleaner ` +
          `air is no longer defensible at this concentration.`
        : `Indoor CO₂ reached ${ctx.indoor.co2Ppm.toFixed(0)} ppm against a ceiling of ` +
          `${ceiling}. Outdoor air is not clean, but this interval is the least bad in ` +
          `the forecast window across every pollutant, so the unavoidable flush happens now.`,
    });
  } else if (sealed && ctx.indoor.co2Ppm >= ceiling && cleanest) {
    // Over the ceiling but holding for a cleaner hour. The agent says when.
    purgePlannedFor = cleanest.at;
  }

  return { proposals, latches, state: { sealed, purgePlannedFor } };
}
