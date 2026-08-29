import { describe, test, expect, afterAll } from 'bun:test';
import { getDb } from './db';
import {
  saveBuilding, getBuilding, listBuildingsForOrg, getLatestBuildingForOrg,
  saveRun, getLatestRun, listRunsForOrg,
} from './buildings-store';
import type { Building } from 'core/contracts';

/**
 * Runs against the real Neon instance — there's no in-memory Postgres to
 * swap in. Every id/email here is unique to this test file and cleaned up in
 * afterAll, the same pattern established in the capture route test.
 */

const building: Building = {
  id: 'live-1', name: 'Test Tower', segmentId: 'seg_1_1', lat: 40.7, lon: -74.0,
  floorAreaM2: 5000, nominalSetpointF: 72, thermalMassHours: 6,
  facades: [{ id: 'n', azimuthDeg: 0, glazedAreaM2: 100, tintable: true }],
};

const orgA = `test-org-a-${crypto.randomUUID()}`;
const orgB = `test-org-b-${crypto.randomUUID()}`;
const user = `test-user-${crypto.randomUUID()}`;
const buildingIds: string[] = [];

afterAll(async () => {
  const sql = await getDb();
  await sql`DELETE FROM runs WHERE building_id = ANY(${buildingIds})`;
  await sql`DELETE FROM saved_buildings WHERE org_id IN (${orgA}, ${orgB})`;
});

// Foreign keys require the referenced org/user rows to exist first.
async function seedOrgsAndUser() {
  const sql = await getDb();
  await sql`INSERT INTO users (id, email, name, created_at) VALUES (${user}, ${user + '@example.com'}, null, ${Date.now()}) ON CONFLICT DO NOTHING`;
  await sql`INSERT INTO organizations (id, name, created_at) VALUES (${orgA}, 'Org A', ${Date.now()}) ON CONFLICT DO NOTHING`;
  await sql`INSERT INTO organizations (id, name, created_at) VALUES (${orgB}, 'Org B', ${Date.now()}) ON CONFLICT DO NOTHING`;
}
await seedOrgsAndUser();

describe('buildings-store', () => {
  test('saves and retrieves a building', async () => {
    const id = crypto.randomUUID();
    buildingIds.push(id);
    await saveBuilding({
      id, orgId: orgA, address: '1 Main St', lat: 40.7, lon: -74,
      floorAreaM2: 5000, building, createdBy: user, createdAt: 1_000,
    });
    expect((await getBuilding(id))?.address).toBe('1 Main St');
  });

  test('getBuilding returns null for an unknown id', async () => {
    expect(await getBuilding('missing-id-does-not-exist')).toBeNull();
  });

  test('lists buildings scoped to one org only', async () => {
    const idA = crypto.randomUUID();
    const idB = crypto.randomUUID();
    buildingIds.push(idA, idB);
    await saveBuilding({ id: idA, orgId: orgA, address: 'A', lat: 1, lon: 1, floorAreaM2: 1, building, createdBy: user, createdAt: 1 });
    await saveBuilding({ id: idB, orgId: orgB, address: 'B', lat: 1, lon: 1, floorAreaM2: 1, building, createdBy: user, createdAt: 2 });
    const inOrgA = await listBuildingsForOrg(orgA);
    expect(inOrgA.some((b) => b.id === idA)).toBe(true);
    expect(inOrgA.some((b) => b.id === idB)).toBe(false);
  });

  test('getLatestBuildingForOrg returns the most recently created one', async () => {
    const idOld = crypto.randomUUID();
    const idNew = crypto.randomUUID();
    buildingIds.push(idOld, idNew);
    const org = `test-org-latest-${crypto.randomUUID()}`;
    const sql = await getDb();
    await sql`INSERT INTO organizations (id, name, created_at) VALUES (${org}, 'Org Latest', ${Date.now()})`;
    await saveBuilding({ id: idOld, orgId: org, address: 'Old', lat: 1, lon: 1, floorAreaM2: 1, building, createdBy: user, createdAt: 1 });
    await saveBuilding({ id: idNew, orgId: org, address: 'New', lat: 1, lon: 1, floorAreaM2: 1, building, createdBy: user, createdAt: 2 });
    expect((await getLatestBuildingForOrg(org))?.address).toBe('New');
    await sql`DELETE FROM saved_buildings WHERE org_id = ${org}`;
    await sql`DELETE FROM organizations WHERE id = ${org}`;
  });

  test('getLatestBuildingForOrg returns null for an org with none', async () => {
    expect(await getLatestBuildingForOrg('org-with-nothing-captured')).toBeNull();
  });

  test('saveRun persists an artifact and assumptions, retrievable by building id', async () => {
    const id = crypto.randomUUID();
    buildingIds.push(id);
    await saveBuilding({ id, orgId: orgA, address: 'A', lat: 1, lon: 1, floorAreaM2: 1, building, createdBy: user, createdAt: 1 });
    await saveRun({ id: crypto.randomUUID(), buildingId: id, capturedAt: 5, artifact: { hello: 'world' }, assumptions: ['x'] });
    const run = await getLatestRun(id);
    expect(run?.artifact).toEqual({ hello: 'world' });
    expect(run?.assumptions).toEqual(['x']);
  });

  test('getLatestRun returns the newest run when a building has more than one', async () => {
    const id = crypto.randomUUID();
    buildingIds.push(id);
    await saveBuilding({ id, orgId: orgA, address: 'A', lat: 1, lon: 1, floorAreaM2: 1, building, createdBy: user, createdAt: 1 });
    await saveRun({ id: crypto.randomUUID(), buildingId: id, capturedAt: 5, artifact: { day: 1 }, assumptions: [] });
    await saveRun({ id: crypto.randomUUID(), buildingId: id, capturedAt: 10, artifact: { day: 2 }, assumptions: [] });
    expect((await getLatestRun(id))?.artifact).toEqual({ day: 2 });
  });

  test('listRunsForOrg joins building address and is scoped to the org', async () => {
    const id = crypto.randomUUID();
    buildingIds.push(id);
    await saveBuilding({ id, orgId: orgA, address: 'Listed Address', lat: 1, lon: 1, floorAreaM2: 1, building, createdBy: user, createdAt: 1 });
    await saveRun({ id: crypto.randomUUID(), buildingId: id, capturedAt: 5, artifact: { ok: true }, assumptions: [] });
    const runs = await listRunsForOrg(orgA);
    expect(runs.some((r) => r.buildingId === id && r.buildingAddress === 'Listed Address')).toBe(true);
  });
});
