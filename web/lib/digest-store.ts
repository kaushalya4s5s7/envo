import type { Database } from 'bun:sqlite';
import { db as defaultDb } from './db';

export type Cadence = 'daily' | 'weekly';

export interface DigestSubscription {
  userEmail: string;
  buildingId: string;
  cadence: Cadence;
  createdAt: number;
}

export function subscribe(
  userEmail: string, buildingId: string, cadence: Cadence, database: Database = defaultDb,
) {
  database.query(`
    INSERT INTO digest_subscription (user_email, building_id, cadence, created_at)
    VALUES ($userEmail, $buildingId, $cadence, $createdAt)
    ON CONFLICT (user_email, building_id) DO UPDATE SET cadence = excluded.cadence
  `).run({
    $userEmail: userEmail, $buildingId: buildingId, $cadence: cadence, $createdAt: Date.now(),
  });
}

export function getSubscription(
  userEmail: string, buildingId: string, database: Database = defaultDb,
): DigestSubscription | null {
  const row = database.query(
    'SELECT * FROM digest_subscription WHERE user_email = $userEmail AND building_id = $buildingId',
  ).get({ $userEmail: userEmail, $buildingId: buildingId }) as
    { user_email: string; building_id: string; cadence: Cadence; created_at: number } | null;
  return row
    ? { userEmail: row.user_email, buildingId: row.building_id, cadence: row.cadence, createdAt: row.created_at }
    : null;
}
