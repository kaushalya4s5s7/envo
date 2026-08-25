import type { Proposal } from '../contracts';
import { COMFORT, PRECOOL } from '../utils';
import type { PolicyContext, PolicyResult } from './types';

/**
 * Policy A — pre cool, then coast.
 *
 * Two phases, and the second is what makes it worth anything:
 *
 *   charge — a peak is forecast and there is headroom: drop the setpoint and
 *            push coolth into the structure while conditions are cheap.
 *   coast  — the peak has arrived: let the zone float back up and live off the
 *            stored mass, cutting load exactly when it is most expensive.
 *
 * Charging without coasting is just running cold all day. Measured against the
 * real 2026-08-07 capture, that spent more energy than doing nothing at all.
 *
 * Demand response systems already pre cool. What they lack is a forecast for
 * *this* block: a citywide feed pre cools the shaded riverside tower and the
 * asphalt surrounded low rise identically, and their real peaks differ by hours.
 */

export type PrecoolPhase = 'idle' | 'charge' | 'coast';

export interface PrecoolState {
  /** Highest apparent temperature in the actionable forecast window. */
  forecastPeakF: number | null;
  phase: PrecoolPhase;
}

export function precoolPolicy(ctx: PolicyContext): PolicyResult<PrecoolState> {
  // Anchored to what this building actually holds, not to a constant of ours.
  const nominal = ctx.building.nominalSetpointF;
  const CHARGE_TARGET = nominal - PRECOOL.DELTA_F;
  const COAST_TARGET = Math.min(COMFORT.T_MAX_F, nominal + PRECOOL.DELTA_F);
  const proposals: Proposal[] = [];
  const window = ctx.env.forecast;
  const now = ctx.env.now.apparentTempF;
  const current = ctx.actuators.setpointF;

  const peak = window.length
    ? window.reduce((worst, r) => (r.apparentTempF > worst.apparentTempF ? r : worst), window[0]!)
    : null;

  const peakIsHere = now >= PRECOOL.TRIGGER_F;
  const charged = current <= CHARGE_TARGET;

  // COAST — the peak is here and the structure is charged. Spend the mass.
  if (peakIsHere && charged) {
    proposals.push(setpoint(COAST_TARGET, 'coast',
      `Apparent temperature at this segment has reached ${now.toFixed(0)} °F and the structure was ` +
      `pre cooled to ${CHARGE_TARGET} °F. Letting the zone float to ${COAST_TARGET} °F and coasting on ` +
      `stored mass, which cuts plant load during the most expensive hours of the day.`,
      now, PRECOOL.TRIGGER_F));
    return done(proposals, ctx, peak, 'coast');
  }

  // CHARGE — a peak is coming, there is headroom, and we are not already there.
  if (peak) {
    const hasHeadroom = now < peak.apparentTempF - PRECOOL.HEADROOM_F;
    if (peak.apparentTempF >= PRECOOL.TRIGGER_F && hasHeadroom && !charged && CHARGE_TARGET >= COMFORT.T_MIN_F) {
      const hour = `${String(peak.at.getUTCHours()).padStart(2, '0')}:00 UTC`;
      proposals.push(setpoint(CHARGE_TARGET, 'charge',
        `Apparent temperature at this segment is forecast to reach ${peak.apparentTempF.toFixed(0)} °F ` +
        `around ${hour}, against a trigger of ${PRECOOL.TRIGGER_F}. Dropping the setpoint ` +
        `${PRECOOL.DELTA_F} °F over ${PRECOOL.RAMP_MIN} minutes to charge thermal mass now and coast later.`,
        peak.apparentTempF, PRECOOL.TRIGGER_F));
      return done(proposals, ctx, peak, 'charge');
    }
  }

  // IDLE — nothing to act on. Return to nominal only when no peak is still
  // coming: discharging the mass right before it is needed would waste the charge.
  const peakComing = peak !== null && peak.apparentTempF >= PRECOOL.TRIGGER_F;
  if (!peakIsHere && !peakComing && current !== nominal) {
    proposals.push(setpoint(nominal, 'idle',
      `The forecast peak has passed and apparent temperature is ${now.toFixed(0)} °F, below the ` +
      `${PRECOOL.TRIGGER_F} °F trigger. Returning the zone to its nominal setpoint.`,
      now, PRECOOL.TRIGGER_F));
  }
  return done(proposals, ctx, peak, 'idle');
}

function setpoint(
  setpointF: number, phase: PrecoolPhase, rationale: string, observed: number, threshold: number,
): Proposal {
  return {
  policy: 'precool',
  command: { actuator: 'hvac_setpoint', setpointF, rampMin: PRECOOL.RAMP_MIN },
  priority: 'energy',
  trigger: { parameter: 'apparentTempF', observed, threshold, sustainedIntervals: 1 },
  rationale: `${rationale} (phase: ${phase})`,
  };
}

const done = (
  proposals: Proposal[], ctx: PolicyContext, peak: { apparentTempF: number } | null, phase: PrecoolPhase,
): PolicyResult<PrecoolState> => ({
  proposals,
  latches: {},
  state: { forecastPeakF: peak?.apparentTempF ?? null, phase },
});
