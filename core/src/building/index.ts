import type { Building, Facade } from '../contracts';

/**
 * Demo building.
 *
 * The coordinates are a **real hot tile**: the warmest of 4265 tiles in a 23 mi²
 * FortyGuard heatmap of Manhattan at 2026-07-18 15:00, at 27.33 °C against a
 * citywide mean of 26.83. Chosen deliberately, because a building in a heat
 * island is exactly who a citywide average under serves.
 *
 * The building itself is not a real surveyed structure: floor area, facades, and
 * `thermalMassHours` are modeled. Only the location and its thermal context are real.
 */
export const demoBuilding: Building = {
  id: 'demo-nyc-001',
  name: 'Flatiron district tower',
  segmentId: 'seg_40.7259_-73.9955',
  lat: 40.7259,
  lon: -73.9955,
  floorAreaM2: 14200,
  nominalSetpointF: 72,
  thermalMassHours: 3.4,
  facades: [
    { id: 'north', azimuthDeg: 0, glazedAreaM2: 610, tintable: false },
    { id: 'east', azimuthDeg: 90, glazedAreaM2: 840, tintable: true },
    { id: 'south', azimuthDeg: 180, glazedAreaM2: 610, tintable: true },
    { id: 'west', azimuthDeg: 270, glazedAreaM2: 840, tintable: true },
  ],
};

/** Throws rather than returning undefined: an unknown facade is a wiring bug, not a state. */
export function facadeById(building: Building, id: string): Facade {
  const found = building.facades.find((f) => f.id === id);
  if (!found) throw new Error(`unknown facade "${id}" on building "${building.id}"`);
  return found;
}

export function tintableFacades(building: Building): Facade[] {
  return building.facades.filter((f) => f.tintable);
}
