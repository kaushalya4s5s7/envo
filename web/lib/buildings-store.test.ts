import { describe, test, expect, beforeEach } from 'bun:test';
import { createDb } from './db';
import {
  saveBuilding, getBuilding, listBuildingsForUser, getLatestBuildingForUser,
  saveRun, getLatestRun,
} from './buildings-store';
import type { Building } from 'core/contracts';

const building: Building = {
  id: 'live-1', name: 'Test Tower', segmentId: 'seg_1_1', lat: 40.7, lon: -74.0,
  floorAreaM2: 5000, nominalSetpointF: 72, thermalMassHours: 6,
  facades: [{ id: 'n', azimuthDeg: 0, glazedAreaM2: 100, tintable: true }],
};

describe('buildings-store', () => {
  let db: ReturnType<typeof createDb>;
  beforeEach(() => { db = createDb(':memory:'); });

  test('saves and retrieves a building', () => {
    saveBuilding(
      { id: 'b1', userEmail: 'a@b.com', address: '1 Main St', lat: 40.7, lon: -74, floorAreaM2: 5000, building, createdAt: 1_000 },
      db,
    );
    expect(getBuilding('b1', db)?.address).toBe('1 Main St');
  });

  test('getBuilding returns null for an unknown id', () => {
    expect(getBuilding('missing', db)).toBeNull();
  });

  test('lists buildings scoped to one user only', () => {
    saveBuilding({ id: 'b1', userEmail: 'a@b.com', address: 'A', lat: 1, lon: 1, floorAreaM2: 1, building, createdAt: 1 }, db);
    saveBuilding({ id: 'b2', userEmail: 'z@z.com', address: 'B', lat: 1, lon: 1, floorAreaM2: 1, building, createdAt: 2 }, db);
    const mine = listBuildingsForUser('a@b.com', db);
    expect(mine).toHaveLength(1);
    expect(mine[0]?.address).toBe('A');
  });

  test('getLatestBuildingForUser returns the most recently created one', () => {
    saveBuilding({ id: 'b1', userEmail: 'a@b.com', address: 'Old', lat: 1, lon: 1, floorAreaM2: 1, building, createdAt: 1 }, db);
    saveBuilding({ id: 'b2', userEmail: 'a@b.com', address: 'New', lat: 1, lon: 1, floorAreaM2: 1, building, createdAt: 2 }, db);
    expect(getLatestBuildingForUser('a@b.com', db)?.address).toBe('New');
  });

  test('getLatestBuildingForUser returns null when the user has none', () => {
    expect(getLatestBuildingForUser('nobody@nowhere.com', db)).toBeNull();
  });

  test('saveRun persists an artifact and assumptions, retrievable by building id', () => {
    saveBuilding({ id: 'b1', userEmail: 'a@b.com', address: 'A', lat: 1, lon: 1, floorAreaM2: 1, building, createdAt: 1 }, db);
    saveRun({ id: 'r1', buildingId: 'b1', capturedAt: 5, artifact: { hello: 'world' }, assumptions: ['x'] }, db);
    const run = getLatestRun('b1', db);
    expect(run?.artifact).toEqual({ hello: 'world' });
    expect(run?.assumptions).toEqual(['x']);
  });

  test('getLatestRun returns the newest run when a building has more than one', () => {
    saveBuilding({ id: 'b1', userEmail: 'a@b.com', address: 'A', lat: 1, lon: 1, floorAreaM2: 1, building, createdAt: 1 }, db);
    saveRun({ id: 'r1', buildingId: 'b1', capturedAt: 5, artifact: { day: 1 }, assumptions: [] }, db);
    saveRun({ id: 'r2', buildingId: 'b1', capturedAt: 10, artifact: { day: 2 }, assumptions: [] }, db);
    expect(getLatestRun('b1', db)?.artifact).toEqual({ day: 2 });
  });
});
