import type { TwinState } from '../contracts';
import { INTERVAL_MIN } from '../utils';

/**
 * Digital twin of one building.
 *
 * Every quantity here is **modeled, never measured**, and the model is deliberately
 * simple: first order lags on temperature, particulates, and CO₂. It exists to make
 * the consequences of a control decision visible, not to be a building simulator.
 *
 * docs/decisions/product/honesty-rails.md forbids presenting any of this as metered.
 *
 * PM2.5 is **µg/m³ concentration**, not AQI. Mixing AQI values linearly is
 * physically wrong: AQI is a piecewise index, not an additive quantity. The
 * conversion happens at the normalization boundary, not here.
 */
export interface TwinInput {
  at: Date;
  outdoorTempF: number;
  /** µg/m³. */
  outdoorPm25: number;
  setpointF: number;
  /** 0..1. What the BMS actually delivered, not what was requested. */
  outsideAirFraction: number;
  occupants: number;
}

/** Outdoor background, ppm. Indoor CO₂ can approach but not fall below it. */
const OUTDOOR_CO2_PPM = 420;
/** Leakage when the intake is shut. A sealed building is never truly sealed. */
const INFILTRATION = 0.05;
/**
 * Outdoor air changes per interval per unit of damper position.
 *
 * The damper position is a fraction of *supply* airflow, not a fraction of room
 * volume. Without this the model exchanged only 24% of the air per hour at a
 * normal damper position and CO₂ settled near 1200 ppm, above the ceiling, which
 * kept the purge latch permanently engaged. Calibrated so a normally ventilated
 * office settles near 810 ppm and a sealed one rises about 224 ppm/h, both
 * matching what BOPTEST measured.
 */
const VENTILATION_EFFECTIVENESS = 1.6;
/** Fraction of particulates the filter removes from incoming air. */
const FILTER_EFFICIENCY = 0.6;
/** Fraction of the gap to the target closed in one interval. */
const TEMP_LAG = 0.45;
/** How fast the structure follows the air. Deliberately slow: that is the point of mass. */
const MASS_LAG = 0.18;
/** °F of cooling load offset per °F the mass sits below the zone. */
const MASS_GAIN = 1.6;
const PM_LAG = 0.5;
/**
 * ppm added per occupant per hour at zero ventilation.
 *
 * Calibrated against BOPTEST rather than assumed: the emulator measured a sealed
 * office rising about 230 ppm/h with roughly this occupancy, and sitting near
 * 410 ppm under normal ventilation. The original 3.2 produced 547 ppm/h and a
 * 2050 ppm steady state, which kept the purge latch permanently engaged so the
 * air quality seal could never fire.
 * docs/decisions/platform/sandbox-findings.md
 */
const CO2_PER_OCCUPANT_PPM_H = 1.35;
/** kWh per °F of cooling delivered, per interval. */
const KWH_PER_DEGREE = 1.8;
/**
 * How many °F of load the plant can offset.
 *
 * Sized so the building holds setpoint on a 95 °F design day at minimum
 * ventilation and begins to lose the zone above it, which is what a real plant
 * does. The earlier value of 22 meant a 103 °F day never troubled the building
 * at all, so pre cooling had nothing to demonstrate.
 */
const CAPACITY_F = 10;

export function initialTwinState(at: Date, zoneTempF: number): TwinState {
  return {
    at,
    zoneTempF,
    massTempF: zoneTempF,
    indoorPm25: 6,
    indoorCo2Ppm: 520,
    outsideAirFraction: 0.2,
    coolingKwh: 0,
  };
}

export function stepTwin(state: TwinState, input: TwinInput): TwinState {
  const oa = input.outsideAirFraction;
  if (!Number.isFinite(oa) || oa < 0 || oa > 1) {
    throw new RangeError(`outsideAirFraction must be 0..1, received ${oa}`);
  }

  const hours = INTERVAL_MIN / 60;
  /** Total air exchange: what the damper delivers, plus what leaks in regardless. */
  const exchange = Math.min(1, (oa + (1 - oa) * INFILTRATION) * VENTILATION_EFFECTIVENESS);

  // Cooling load, in °F of lift the plant must offset. Outside air dominates it.
  const lift = Math.max(0, input.outdoorTempF - input.setpointF);
  const rawLoadF = lift * (0.25 + 0.75 * oa);

  // Stored coolth, measured against the air temperature the plant is holding.
  // Structure sitting below that absorbs heat the plant would otherwise remove,
  // which is how an earlier pre cool pays for itself. Measuring against the
  // current zone instead would read zero at equilibrium and the benefit would
  // vanish exactly when it should appear.
  const storedF = Math.max(0, input.setpointF - state.massTempF);
  const loadF = Math.max(0, rawLoadF - storedF * MASS_GAIN);

  // Temperature: the plant holds the setpoint until its capacity is exceeded,
  // then the zone floats above it by however much load went unmet.
  const target = input.setpointF + Math.max(0, loadF - CAPACITY_F);
  const zoneTempF = state.zoneTempF + (target - state.zoneTempF) * TEMP_LAG;

  // The structure follows the air slowly. Charging it is what pre cooling buys.
  const massTempF = state.massTempF + (zoneTempF - state.massTempF) * MASS_LAG;

  // Particulates: incoming air is filtered; what is already inside decays toward it.
  const pmTarget = input.outdoorPm25 * exchange * (1 - FILTER_EFFICIENCY);
  const indoorPm25 = Math.max(0, state.indoorPm25 + (pmTarget - state.indoorPm25) * PM_LAG);

  // CO₂: occupants generate it, ventilation dilutes it toward outdoor background.
  const generated = input.occupants * CO2_PER_OCCUPANT_PPM_H * hours;
  const diluted = (state.indoorCo2Ppm - OUTDOOR_CO2_PPM) * (1 - exchange);
  const indoorCo2Ppm = Math.max(OUTDOOR_CO2_PPM, OUTDOOR_CO2_PPM + diluted + generated * (1 - exchange));

  // Cooling energy: charged for load actually delivered, capped by plant capacity.
  const coolingKwh = state.coolingKwh + Math.min(loadF, CAPACITY_F) * KWH_PER_DEGREE * hours;

  return { at: input.at, zoneTempF, massTempF, indoorPm25, indoorCo2Ppm, outsideAirFraction: oa, coolingKwh };
}
