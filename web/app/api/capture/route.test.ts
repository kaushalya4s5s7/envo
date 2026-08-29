import { describe, test, expect, afterAll } from 'bun:test';
import { GET } from './route';
import { db } from '@/lib/db';
import { saveBuilding, saveRun } from '@/lib/buildings-store';
import type { Building } from 'core/contracts';

/**
 * Covers the one behavior Task 4 actually adds: when the 30-minute in-memory
 * job has expired (getJob returns undefined), GET must fall back to the
 * durable store instead of reporting "expired" for a building that was
 * actually saved. Exercises the real route handler and the real db module —
 * not a mock — since that fallback is the whole point of this plan.
 */

const building: Building = {
  id: 'route-test-1', name: 'Route Test Tower', segmentId: 'seg_9_9', lat: 1, lon: 1,
  floorAreaM2: 1000, nominalSetpointF: 72, thermalMassHours: 6,
  facades: [{ id: 'n', azimuthDeg: 0, glazedAreaM2: 50, tintable: true }],
};

afterAll(() => {
  db.query('DELETE FROM run WHERE building_id = $id').run({ $id: 'route-test-1' });
  db.query('DELETE FROM saved_building WHERE id = $id').run({ $id: 'route-test-1' });
});

describe('GET /api/capture — durable fallback', () => {
  test('serves a saved building once the in-memory job has expired', async () => {
    saveBuilding({
      id: 'route-test-1', userEmail: 'route-test@example.com', address: '1 Test St',
      lat: 1, lon: 1, floorAreaM2: 1000, building, createdAt: Date.now(),
    });
    saveRun({
      id: 'route-test-1-run', buildingId: 'route-test-1', capturedAt: Date.now(),
      artifact: { building: { name: 'Route Test Tower' } }, assumptions: ['test assumption'],
    });

    const response = await GET(new Request('http://localhost/api/capture?id=route-test-1'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.stage).toBe('done');
    expect(body.address).toBe('1 Test St');
    expect(body.artifact).toEqual({ building: { name: 'Route Test Tower' } });
    expect(body.assumptions).toEqual(['test assumption']);
  });

  test('reports expired for an id that was never saved', async () => {
    const response = await GET(new Request('http://localhost/api/capture?id=never-existed'));
    expect(response.status).toBe(404);
  });
});
