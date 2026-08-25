import type { Proposal } from '../contracts';
import { tintableFacades } from '../building';
import { TINT } from '../utils';
import { beamOnFacade, derateForCloud, solarPosition } from '../weather/solar';
import type { PolicyContext, PolicyResult } from './types';

/**
 * Policy B — facade tint.
 *
 * Driven by direct beam projected onto each facade's own orientation, then de
 * rated for cloud. Coordinated shade and HVAC control is already patented and
 * shipping; what those systems lack is the actual beam load on this building's
 * west wall at this hour.
 */

export interface TintState {
  /** De rated beam, W/m², per tintable facade. Surfaced so a decision can be explained. */
  beamByFacade: Record<string, number>;
}

const levelFor = (beamWm2: number): 'clear' | 'medium' | 'dark' =>
  beamWm2 >= TINT.HIGH_WM2 ? 'dark' : beamWm2 >= TINT.MID_WM2 ? 'medium' : 'clear';

export function tintPolicy(ctx: PolicyContext): PolicyResult<TintState> {
  const proposals: Proposal[] = [];
  const beamByFacade: Record<string, number> = {};

  const sun = solarPosition(ctx.env.now.at, { lat: ctx.building.lat, lon: ctx.building.lon });

  for (const facade of tintableFacades(ctx.building)) {
    const clearSkyBeam = beamOnFacade(ctx.env.clearSky.dniWm2, facade.azimuthDeg, sun);
    // Mandatory. Raw clear sky beam tints a west facade under full overcast.
    const beam = derateForCloud(clearSkyBeam, ctx.env.now.cloudCoverPercent);
    beamByFacade[facade.id] = beam;

    const level = levelFor(beam);
    if (level === 'clear') continue;                          // daylight is worth more than the saving
    if (ctx.actuators.tint[facade.id] === level) continue;    // already holding it

    proposals.push({
      policy: 'tint',
      command: { actuator: 'facade_tint', facadeId: facade.id, level },
      priority: 'energy',
      trigger: {
        parameter: `beamOnFacade:${facade.id}`,
        observed: beam,
        threshold: level === 'dark' ? TINT.HIGH_WM2 : TINT.MID_WM2,
        sustainedIntervals: 1,
      },
      rationale:
        `Direct beam on the ${facade.id} facade is ${beam.toFixed(0)} W/m² after de rating ` +
        `${ctx.env.clearSky.dniWm2.toFixed(0)} W/m² clear sky DNI for ${ctx.env.now.cloudCoverPercent.toFixed(0)}% ` +
        `cloud cover. Tinting to ${level} to cut solar heat gain before it becomes cooling load.`,
    });
  }

  // No latches: a tint decision is instantaneous, not sustained.
  return { proposals, latches: {}, state: { beamByFacade } };
}
