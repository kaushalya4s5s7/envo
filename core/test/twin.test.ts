import { describe, expect, it } from 'bun:test';
import { demoBuilding } from '../src/building';
import { initialTwinState, stepTwin, type TwinInput } from '../src/twin';

const at = new Date('2026-07-18T15:00:00Z');

/** Mild, clean, sealed. Every test perturbs one thing from here. */
const calm: TwinInput = {
  at,
  outdoorTempF: 78,
  outdoorPm25: 8,          // µg/m³ concentration, never AQI
  setpointF: 72,
  outsideAirFraction: 0.2,
  occupants: 120,
};

const settle = (input: TwinInput, steps: number, from = initialTwinState(at, 72)) => {
  let state = from;
  for (let i = 0; i < steps; i++) {
    state = stepTwin(state, { ...input, at: new Date(at.getTime() + i * 3_600_000) });
  }
  return state;
};

describe('zone temperature', () => {
  it('moves toward the setpoint gradually rather than snapping to it', () => {
    const start = initialTwinState(at, 78);
    const afterOne = stepTwin(start, { ...calm, setpointF: 68 });
    expect(afterOne.zoneTempF).toBeLessThan(78);
    expect(afterOne.zoneTempF).toBeGreaterThan(68);   // thermal mass, not a step change
  });

  it('converges on the setpoint when held long enough', () => {
    expect(settle({ ...calm, setpointF: 68 }, 24).zoneTempF).toBeCloseTo(68, 0);
  });

  it('drifts toward outdoor conditions when the setpoint is unreachable', () => {
    const hot = settle({ ...calm, outdoorTempF: 104, setpointF: 68, outsideAirFraction: 1 }, 12);
    expect(hot.zoneTempF).toBeGreaterThan(68);
  });
});

describe('indoor PM2.5', () => {
  it('rises with lag when the intake is open under a dirty sky', () => {
    const one = stepTwin(initialTwinState(at, 72), { ...calm, outdoorPm25: 120 });
    expect(one.indoorPm25).toBeGreaterThan(initialTwinState(at, 72).indoorPm25);
    expect(one.indoorPm25).toBeLessThan(120);         // lag, and filtration
  });

  it('decays once the intake closes, without reaching zero', () => {
    const dirty = settle({ ...calm, outdoorPm25: 120 }, 8);
    const sealed = settle({ ...calm, outdoorPm25: 120, outsideAirFraction: 0 }, 8, dirty);
    expect(sealed.indoorPm25).toBeLessThan(dirty.indoorPm25);
    expect(sealed.indoorPm25).toBeGreaterThan(0);      // infiltration is never zero
  });

  it('holds far below outdoor when sealed through a spike', () => {
    const sealed = settle({ ...calm, outdoorPm25: 200, outsideAirFraction: 0 }, 6);
    const open = settle({ ...calm, outdoorPm25: 200, outsideAirFraction: 0.4 }, 6);
    expect(sealed.indoorPm25).toBeLessThan(open.indoorPm25 / 2);
  });
});

describe('indoor CO2', () => {
  it('accumulates when the building is sealed and occupied', () => {
    const sealed = settle({ ...calm, outsideAirFraction: 0 }, 6);
    expect(sealed.indoorCo2Ppm).toBeGreaterThan(initialTwinState(at, 72).indoorCo2Ppm);
  });

  it('is flushed by opening the intake', () => {
    const stuffy = settle({ ...calm, outsideAirFraction: 0 }, 8);
    const purged = settle({ ...calm, outsideAirFraction: 0.6 }, 4, stuffy);
    expect(purged.indoorCo2Ppm).toBeLessThan(stuffy.indoorCo2Ppm);
  });

  it('does not accumulate in an empty building', () => {
    const empty = settle({ ...calm, outsideAirFraction: 0, occupants: 0 }, 6);
    expect(empty.indoorCo2Ppm).toBeLessThanOrEqual(initialTwinState(at, 72).indoorCo2Ppm + 1);
  });

  /** The conflict Policy C has to arbitrate: sealing for smoke drives CO2 up. */
  it('trades against PM2.5 — sealing protects lungs but builds CO2', () => {
    const sealed = settle({ ...calm, outdoorPm25: 200, outsideAirFraction: 0 }, 8);
    const open = settle({ ...calm, outdoorPm25: 200, outsideAirFraction: 0.5 }, 8);
    expect(sealed.indoorPm25).toBeLessThan(open.indoorPm25);
    expect(sealed.indoorCo2Ppm).toBeGreaterThan(open.indoorCo2Ppm);
  });
});

describe('cooling energy', () => {
  it('only ever accumulates', () => {
    const a = settle(calm, 4);
    const b = settle(calm, 8);
    expect(b.coolingKwh).toBeGreaterThan(a.coolingKwh);
  });

  it('costs more to pull hot outside air than to recirculate', () => {
    const economizing = settle({ ...calm, outdoorTempF: 100, outsideAirFraction: 0.8 }, 6);
    const recirculating = settle({ ...calm, outdoorTempF: 100, outsideAirFraction: 0.1 }, 6);
    expect(economizing.coolingKwh).toBeGreaterThan(recirculating.coolingKwh);
  });

  it('costs nothing when the outside is already cooler than the setpoint', () => {
    const free = settle({ ...calm, outdoorTempF: 58, outsideAirFraction: 0.9 }, 6);
    expect(free.coolingKwh).toBe(0);
  });
});

describe('state', () => {
  it('carries the timestamp of the interval it represents', () => {
    expect(stepTwin(initialTwinState(at, 72), calm).at.toISOString()).toBe(at.toISOString());
  });

  it('refuses an outside air fraction outside 0..1', () => {
    expect(() => stepTwin(initialTwinState(at, 72), { ...calm, outsideAirFraction: 1.4 })).toThrow();
  });
});

/**
 * Pre cooling works by charging the building's thermal mass while conditions are
 * cheap, then coasting on it. Without mass in the model the policy is pure waste,
 * which is exactly what the first real capture showed.
 */
describe('thermal mass', () => {
  const hot: TwinInput = { ...calm, outdoorTempF: 103, setpointF: 72 };

  it('lags the zone rather than tracking it', () => {
    const start = initialTwinState(at, 78);
    const after = stepTwin(start, { ...calm, setpointF: 68 });
    const zoneMoved = Math.abs(after.zoneTempF - start.zoneTempF);
    const massMoved = Math.abs(after.massTempF - start.massTempF);
    expect(massMoved).toBeLessThan(zoneMoved);
  });

  it('is charged by holding a lower setpoint', () => {
    const precooled = settle({ ...calm, setpointF: 68 }, 6);
    const untouched = settle(calm, 6);
    expect(precooled.massTempF).toBeLessThan(untouched.massTempF);
  });

  /** The whole justification for Policy A. */
  it('makes a pre cooled building cheaper to run through a hot hour', () => {
    const precooled = settle({ ...calm, setpointF: 68 }, 6);
    const untouched = settle(calm, 6);

    const afterPrecool = stepTwin({ ...precooled, coolingKwh: 0 }, hot);
    const afterNothing = stepTwin({ ...untouched, coolingKwh: 0 }, hot);
    expect(afterPrecool.coolingKwh).toBeLessThan(afterNothing.coolingKwh);
  });

  it('gives up its stored coolth over time rather than helping forever', () => {
    const precooled = settle({ ...calm, setpointF: 68 }, 6);
    const firstHour = stepTwin({ ...precooled, coolingKwh: 0 }, hot);
    let later = precooled;
    for (let i = 0; i < 6; i++) later = stepTwin(later, hot);
    const seventhHour = stepTwin({ ...later, coolingKwh: 0 }, hot);
    expect(seventhHour.coolingKwh).toBeGreaterThan(firstHour.coolingKwh);
  });
});

describe('plant capacity', () => {
  it('holds the setpoint on a design day', () => {
    const design = settle({ ...calm, outdoorTempF: 95, setpointF: 72 }, 12);
    expect(design.zoneTempF).toBeCloseTo(72, 0);
  });

  it('loses the zone when the load exceeds what the plant can offset', () => {
    const extreme = settle({ ...calm, outdoorTempF: 115, setpointF: 72, outsideAirFraction: 0.6 }, 12);
    expect(extreme.zoneTempF).toBeGreaterThan(72.5);
  });
});

/**
 * CO2 calibrated against BOPTEST, not against our own intuition.
 *
 * The emulator measured a sealed office rising about 230 ppm per hour
 * (763 → 961 → 1179 → 1414 → 1622 over four hours) and sitting near 410 ppm
 * under normal ventilation. Our first constants produced 547 ppm/h sealed and a
 * 2050 ppm steady state, which is a badly ventilated building, and it made the
 * purge latch engage permanently so the seal never fired.
 * docs/decisions/platform/sandbox-findings.md
 */
describe('CO2, calibrated against the emulator', () => {
  const occupied: TwinInput = { ...calm, occupants: 180 };

  it('rises at roughly the rate BOPTEST measured when sealed', () => {
    const start = settle({ ...occupied, outsideAirFraction: 0.2 }, 12);
    const after = stepTwin({ ...start, outsideAirFraction: 0 }, { ...occupied, outsideAirFraction: 0 });
    const ramp = after.indoorCo2Ppm - start.indoorCo2Ppm;
    expect(ramp).toBeGreaterThan(150);
    expect(ramp).toBeLessThan(320);
  });

  it('settles at a plausible occupied concentration under normal ventilation', () => {
    const steady = settle({ ...occupied, outsideAirFraction: 0.2 }, 24).indoorCo2Ppm;
    expect(steady).toBeGreaterThan(500);
    expect(steady).toBeLessThan(1100);   // below the ceiling, or the purge never releases
  });

  it('clears below the purge release threshold when the intake opens wide', () => {
    const stuffy = settle({ ...occupied, outsideAirFraction: 0 }, 6);
    const flushed = settle({ ...occupied, outsideAirFraction: 0.5 }, 8, stuffy);
    expect(flushed.indoorCo2Ppm).toBeLessThan(stuffy.indoorCo2Ppm);
    expect(flushed.indoorCo2Ppm).toBeLessThan(800);
  });
});
