import { describe, expect, it } from 'bun:test';
import {
  ZONES, cToK, damperCommandToInputs, kToF, kpiToMetrics, readZone, setpointCommandToInputs,
} from '../src/bms/boptest/protocol';

const live = await Bun.file(
  new URL('../../docs/reference/boptest/samples/points-and-advance.json', import.meta.url),
).json();

describe('units at the boundary', () => {
  it('converts Kelvin to Fahrenheit', () => {
    expect(kToF(298.15)).toBeCloseTo(77, 1);
    expect(kToF(273.15)).toBeCloseTo(32, 6);
  });

  it('converts Celsius to Kelvin for setpoints', () => {
    expect(cToK(0)).toBeCloseTo(273.15, 6);
  });

  it('round trips a Fahrenheit setpoint through Kelvin', () => {
    const f = 72;
    expect(kToF(cToK((f - 32) * 5 / 9))).toBeCloseTo(f, 6);
  });
});

describe('commands become BOPTEST inputs', () => {
  /** The emulator needs both keys: a value and an activation flag. */
  it('writes the damper as a value plus an activation flag', () => {
    const inputs = damperCommandToInputs(0);
    expect(inputs['hvac_oveAhu_yOA_u']).toBe(0);
    expect(inputs['hvac_oveAhu_yOA_activate']).toBe(1);
  });

  it('hands the point back to the emulator when we are not driving it', () => {
    expect(damperCommandToInputs(null)['hvac_oveAhu_yOA_activate']).toBe(0);
  });

  it('rejects a damper fraction outside the point range', () => {
    expect(() => damperCommandToInputs(1.4)).toThrow();
  });

  it('drives the cooling setpoint of every zone', () => {
    const inputs = setpointCommandToInputs(72);
    for (const zone of ZONES) {
      expect(inputs[`hvac_oveZonSup${zone}_TZonCooSet_u`]).toBeCloseTo(295.372, 2);
      expect(inputs[`hvac_oveZonSup${zone}_TZonCooSet_activate`]).toBe(1);
    }
  });

  it('refuses a setpoint the emulator would reject', () => {
    // The point range is 285.15 to 313.15 K, roughly 53.6 to 104 °F.
    expect(() => setpointCommandToInputs(40)).toThrow(/range/i);
    expect(() => setpointCommandToInputs(120)).toThrow(/range/i);
  });
});

describe('reading a real advance response', () => {
  const payload = live.advance_response_excerpt;

  it('reads zone temperature in Fahrenheit from the Kelvin the API returns', () => {
    const zone = readZone(payload, 'Cor');
    expect(zone.tempF).toBeCloseTo(kToF(payload['hvac_reaZonCor_TZon_y']), 6);
    expect(zone.tempF).toBeGreaterThan(60);
    expect(zone.tempF).toBeLessThan(90);
  });

  it('reads zone CO2 as ppm, which the emulator already reports', () => {
    expect(readZone(payload, 'Cor').co2Ppm).toBe(payload['hvac_reaZonCor_CO2Zon_y']);
  });

  it('throws on a zone the response does not contain, rather than returning zero', () => {
    expect(() => readZone({}, 'Cor')).toThrow(/Cor/);
  });
});

describe('KPIs', () => {
  it('maps the emulator scoring onto our metric names', () => {
    const m = kpiToMetrics({
      tdis_tot: 1.5, idis_tot: 2.5, ener_tot: 10, cost_tot: 3, emis_tot: 4,
      pele_tot: 9, pgas_tot: null, pdih_tot: null, time_rat: null,
    });
    expect(m.energyKwh).toBe(10);
    expect(m.thermalDiscomfort).toBe(1.5);
    expect(m.airQualityDiscomfort).toBe(2.5);
    expect(m.costTotal).toBe(3);
  });

  /** null means the emulator did not compute it. It is not zero. */
  it('keeps an uncomputed KPI as null rather than coercing it to zero', () => {
    const m = kpiToMetrics({ ener_tot: 1, tdis_tot: 0, idis_tot: 0, cost_tot: 0, emis_tot: 0,
      pele_tot: null, pgas_tot: null, pdih_tot: null, time_rat: null });
    expect(m.peakElectricW).toBeNull();
  });

  it('accepts the exact key set the live API returned', () => {
    for (const key of live.kpi_keys) expect(typeof key).toBe('string');
    expect(live.kpi_keys).toContain('idis_tot');
    expect(live.kpi_keys).toContain('tdis_tot');
  });
});
