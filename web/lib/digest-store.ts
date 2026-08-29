import { getDb } from './db';

export type Cadence = 'daily' | 'weekly';

export interface DigestSubscription {
  userId: string;
  buildingId: string;
  cadence: Cadence;
  createdAt: number;
}

export async function subscribe(userId: string, buildingId: string, cadence: Cadence): Promise<void> {
  const sql = await getDb();
  await sql`
    INSERT INTO digest_subscriptions (user_id, building_id, cadence, created_at)
    VALUES (${userId}, ${buildingId}, ${cadence}, ${Date.now()})
    ON CONFLICT (user_id, building_id) DO UPDATE SET cadence = excluded.cadence
  `;
}

export async function getSubscription(userId: string, buildingId: string): Promise<DigestSubscription | null> {
  const sql = await getDb();
  const [row] = await sql<{ user_id: string; building_id: string; cadence: Cadence; created_at: string }[]>`
    SELECT * FROM digest_subscriptions WHERE user_id = ${userId} AND building_id = ${buildingId}
  `;
  return row
    ? { userId: row.user_id, buildingId: row.building_id, cadence: row.cadence, createdAt: Number(row.created_at) }
    : null;
}
