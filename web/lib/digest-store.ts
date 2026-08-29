import { getDb, type Db } from './db';

export type Cadence = 'daily' | 'weekly';

export interface DigestSubscription {
  userEmail: string;
  buildingId: string;
  cadence: Cadence;
  createdAt: number;
}

export function subscribe(
  userEmail: string, buildingId: string, cadence: Cadence, database?: Db,
) {
  const db = database ?? getDb();
  const store = db.read();
  const digestSubscriptions = store.digestSubscriptions
    .filter((s) => !(s.userEmail === userEmail && s.buildingId === buildingId));
  digestSubscriptions.push({ userEmail, buildingId, cadence, createdAt: Date.now() });
  db.write({ ...store, digestSubscriptions });
}

export function getSubscription(
  userEmail: string, buildingId: string, database?: Db,
): DigestSubscription | null {
  const row = (database ?? getDb()).read().digestSubscriptions
    .find((s) => s.userEmail === userEmail && s.buildingId === buildingId);
  return row ? { ...row } : null;
}
