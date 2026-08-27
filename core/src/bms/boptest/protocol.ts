/**
 * BOPTEST wire helpers. Pure, so they test against the saved live responses in
 * docs/reference/boptest/samples/ without a running emulator.
 *
 * Contract: docs/reference/boptest/api.md, taken from the project's own OpenAPI
 * spec and from responses we captured on 28 Aug 2026.
 */

/** The five zones of `multizone_office_simple_air`: core, east, north, south, west. */
export const ZONES = ['Cor', 'Eas', 'Nor', 'Sou', 'Wes'] as const;
export type Zone = (typeof ZONES)[number];

export const kToF = (k: number) => (k - 273.15) * 9 / 5 + 32;
export const cToK = (c: number) => c + 273.15;
const fToK = (f: number) => cToK((f - 32) * 5 / 9);

/** Point ranges, read from `GET /inputs`. Violating them is a 400 from the emulator. */
const SETPOINT_MIN_K = 285.15;
const SETPOINT_MAX_K = 313.15;

export type Inputs = Record<string, number>;

/**
 * Outside air damper.
 *
 * `null` means we are not driving this point, so `_activate: 0` hands it back to
 * the emulator's own baseline controller. That is per actuator autonomy, exactly
 * as described in docs/flows/product-flow.md.
 */
export function damperCommandToInputs(fraction: number | null): Inputs {
  if (fraction === null) return { hvac_oveAhu_yOA_activate: 0 };
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) {
    throw new RangeError(`outside air fraction must be 0..1, received ${fraction}`);
  }
  return { hvac_oveAhu_yOA_u: fraction, hvac_oveAhu_yOA_activate: 1 };
}

/** Zone cooling setpoint, applied to every zone. Our model has one zone; this has five. */
export function setpointCommandToInputs(setpointF: number | null): Inputs {
  if (setpointF === null) {
    return Object.fromEntries(ZONES.map((z) => [`hvac_oveZonSup${z}_TZonCooSet_activate`, 0]));
  }
  const kelvin = fToK(setpointF);
  if (kelvin < SETPOINT_MIN_K || kelvin > SETPOINT_MAX_K) {
    throw new RangeError(
      `setpoint ${setpointF} °F is outside the point range ${kToF(SETPOINT_MIN_K).toFixed(1)}` +
      ` to ${kToF(SETPOINT_MAX_K).toFixed(1)} °F`,
    );
  }
  return Object.fromEntries(ZONES.flatMap((z) => [
    [`hvac_oveZonSup${z}_TZonCooSet_u`, kelvin],
    [`hvac_oveZonSup${z}_TZonCooSet_activate`, 1],
  ]));
}

export interface ZoneReading {
  tempF: number;
  co2Ppm: number;
}

/** Throws on a missing zone: a silent zero would be a fabricated measurement. */
export function readZone(payload: Record<string, unknown>, zone: Zone): ZoneReading {
  const temp = payload[`hvac_reaZon${zone}_TZon_y`];
  const co2 = payload[`hvac_reaZon${zone}_CO2Zon_y`];
  if (typeof temp !== 'number' || typeof co2 !== 'number') {
    throw new Error(`advance response has no readings for zone ${zone}`);
  }
  return { tempF: kToF(temp), co2Ppm: co2 };
}

export interface BoptestKpi {
  tdis_tot: number | null;
  idis_tot: number | null;
  ener_tot: number | null;
  cost_tot: number | null;
  emis_tot: number | null;
  pele_tot: number | null;
  pgas_tot: number | null;
  pdih_tot: number | null;
  time_rat: number | null;
}

/**
 * The reason the sandbox exists: these are scored by the emulator, not by us.
 * `null` means it was not computed, and stays null. Coercing it to zero would
 * invent a measurement.
 */
export interface SandboxMetrics {
  energyKwh: number | null;
  costTotal: number | null;
  emissions: number | null;
  thermalDiscomfort: number | null;
  airQualityDiscomfort: number | null;
  peakElectricW: number | null;
}

export const kpiToMetrics = (kpi: BoptestKpi): SandboxMetrics => ({
  energyKwh: kpi.ener_tot,
  costTotal: kpi.cost_tot,
  emissions: kpi.emis_tot,
  thermalDiscomfort: kpi.tdis_tot,
  airQualityDiscomfort: kpi.idis_tot,
  peakElectricW: kpi.pele_tot,
});
