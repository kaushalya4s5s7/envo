import { describe, expect, it } from 'bun:test';
import { CAPABILITIES, suggestMappings, type DiscoveredPoint } from '../src/connect';

/**
 * Point mapping is the step that consumes 30 to 40% of BMS integration labour:
 * a building exposes hundreds of points named `hvac_oveAhu_yOA_u` and a human
 * decides which one is the outside air damper.
 *
 * Fixtures are real names taken from a live BOPTEST `multizone_office_simple_air`
 * discovery on 29 Aug 2026, not invented.
 */

const p = (
  name: string, description: string, unit: string | null, kind: 'input' | 'measurement',
): DiscoveredPoint => ({ name, description, unit, min: null, max: null, kind });

const REAL: DiscoveredPoint[] = [
  p('hvac_oveAhu_TSupSet_u', 'Supply air temperature setpoint for AHU', 'K', 'input'),
  p('hvac_oveAhu_dpSet_u', 'Supply duct pressure setpoint for AHU', 'Pa', 'input'),
  p('hvac_oveAhu_yOA_u', 'Outside air damper position setpoint for AHU', '1', 'input'),
  p('hvac_oveZonActCor_yDam_u', 'Damper position setpoint for zone cor', '1', 'input'),
  p('hvac_oveZonSupCor_TZonCooSet_u', 'Zone air temperature cooling setpoint for zone cor', 'K', 'input'),
  p('hvac_oveZonSupCor_TZonHeaSet_u', 'Zone air temperature heating setpoint for zone cor', 'K', 'input'),
  p('hvac_oveZonSupEas_TZonCooSet_u', 'Zone air temperature cooling setpoint for zone eas', 'K', 'input'),
  p('hvac_reaZonCor_TZon_y', 'Zone air temperature measurement for zone cor', 'K', 'measurement'),
  // Reads almost identically and is the wrong sensor: it is duct air, not room air.
  p('hvac_reaZonCor_TSup_y', 'Discharge air temperature to zone measurement for zone cor', 'K', 'measurement'),
  p('hvac_reaAhu_TSup_y', 'Supply air temperature measurement for AHU', 'K', 'measurement'),
  p('hvac_reaZonCor_CO2Zon_y', 'Zone air CO2 measurement for zone cor', 'ppm', 'measurement'),
  p('chi_reaPChi_y', 'Electric power consumed by chiller', 'W', 'measurement'),
];

const forCap = (result: ReturnType<typeof suggestMappings>, c: string) =>
  result.find((r) => r.capability === c)!;

describe('suggestMappings', () => {
  it('finds the outside air damper and not a zone damper', () => {
    const top = forCap(suggestMappings(REAL), 'outside_air_damper').candidates[0]!;
    expect(top.point.name).toBe('hvac_oveAhu_yOA_u');
  });

  it('picks the cooling setpoint, never the heating setpoint', () => {
    const c = forCap(suggestMappings(REAL), 'zone_temp_setpoint').candidates;
    expect(c[0]!.point.name).toContain('TZonCooSet');
    expect(c.map((x) => x.point.name)).not.toContain('hvac_oveZonSupCor_TZonHeaSet_u');
  });

  it('offers every zone as a candidate rather than silently choosing one', () => {
    const c = forCap(suggestMappings(REAL), 'zone_temp_setpoint').candidates;
    expect(c.length).toBeGreaterThan(1);
    expect(c.map((x) => x.point.name)).toContain('hvac_oveZonSupEas_TZonCooSet_u');
  });

  it('picks room air over duct air, which reads almost identically', () => {
    const c = forCap(suggestMappings(REAL), 'zone_temperature').candidates;
    expect(c[0]!.point.name).toBe('hvac_reaZonCor_TZon_y');
    expect(c.map((x) => x.point.name)).not.toContain('hvac_reaZonCor_TSup_y');
    expect(c.map((x) => x.point.name)).not.toContain('hvac_reaAhu_TSup_y');
  });

  it('separates a temperature measurement from a temperature setpoint', () => {
    const temp = forCap(suggestMappings(REAL), 'zone_temperature').candidates[0]!;
    expect(temp.point.name).toBe('hvac_reaZonCor_TZon_y');
    expect(temp.point.kind).toBe('measurement');
  });

  it('matches CO2 on its unit as well as its name', () => {
    const co2 = forCap(suggestMappings(REAL), 'zone_co2').candidates[0]!;
    expect(co2.point.unit).toBe('ppm');
  });

  it('leaves facade tint unmatched, because this building has no such point', () => {
    expect(forCap(suggestMappings(REAL), 'facade_tint').candidates).toHaveLength(0);
  });

  it('never matches an unrelated point such as chiller power', () => {
    const all = suggestMappings(REAL).flatMap((r) => r.candidates.map((c) => c.point.name));
    expect(all).not.toContain('chi_reaPChi_y');
  });

  it('gives every candidate a written reason, never a bare score', () => {
    for (const r of suggestMappings(REAL)) {
      for (const c of r.candidates) expect(c.because.length).toBeGreaterThan(10);
    }
  });

  it('reports which capabilities are required for a policy to run', () => {
    expect(CAPABILITIES.filter((c) => c.required).map((c) => c.id))
      .toEqual(['zone_temp_setpoint', 'zone_temperature']);
  });

  it('returns empty candidates for every capability given no points', () => {
    expect(suggestMappings([]).every((r) => r.candidates.length === 0)).toBe(true);
  });
});
