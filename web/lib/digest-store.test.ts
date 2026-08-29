import { describe, test, expect, afterAll } from 'bun:test';
import { getDb } from './db';
import { subscribe, getSubscription } from './digest-store';

/** FK constraints mean a subscription needs a real user and a real building first. */
const userId = `test-user-${crypto.randomUUID()}`;
const orgId = `test-org-${crypto.randomUUID()}`;
const buildingId = `test-building-${crypto.randomUUID()}`;

async function seed() {
  const sql = await getDb();
  await sql`INSERT INTO users (id, email, name, created_at) VALUES (${userId}, ${userId + '@example.com'}, null, ${Date.now()})`;
  await sql`INSERT INTO organizations (id, name, created_at) VALUES (${orgId}, 'Digest Test Org', ${Date.now()})`;
  await sql`
    INSERT INTO saved_buildings (id, org_id, address, lat, lon, floor_area_m2, building_json, created_by, created_at)
    VALUES (${buildingId}, ${orgId}, 'Digest Test Address', 1, 1, 1, ${sql.json({})}, ${userId}, ${Date.now()})
  `;
}
await seed();

afterAll(async () => {
  const sql = await getDb();
  await sql`DELETE FROM digest_subscriptions WHERE user_id = ${userId}`;
  await sql`DELETE FROM saved_buildings WHERE id = ${buildingId}`;
  await sql`DELETE FROM organizations WHERE id = ${orgId}`;
  await sql`DELETE FROM users WHERE id = ${userId}`;
});

describe('digest-store', () => {
  test('subscribe then getSubscription returns the cadence', async () => {
    await subscribe(userId, buildingId, 'daily');
    expect((await getSubscription(userId, buildingId))?.cadence).toBe('daily');
  });

  test('getSubscription returns null when none exists', async () => {
    expect(await getSubscription('nobody', 'nothing')).toBeNull();
  });

  test('subscribing again for the same user and building replaces the cadence', async () => {
    await subscribe(userId, buildingId, 'daily');
    await subscribe(userId, buildingId, 'weekly');
    expect((await getSubscription(userId, buildingId))?.cadence).toBe('weekly');
  });
});
