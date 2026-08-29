import type { Building } from 'core/contracts';
import { getDb, type Db, type SavedBuildingRow, type RunRow } from './db';

/**
 * Durable counterpart to web/lib/capture-store.ts. That store holds one
 * in-flight capture for 30 minutes; this one holds what a signed-in user has
 * captured, indefinitely, so `/app` and `/app/buildings` survive a reload.
 * See docs/decisions/product/operator-product-shape.md.
 *
 * Every function takes an optional `database`, defaulting to `getDb()` — a
 * function call, not a value, so the store file is only opened the first
 * time one of these actually runs. See web/lib/db.ts.
 */

export interface SavedBuilding {
  id: string;
  userEmail: string;
  address: string;
  lat: number;
  lon: number;
  floorAreaM2: number;
  building: Building;
  createdAt: number;
}

export interface SavedRun {
  id: string;
  buildingId: string;
  capturedAt: number;
  artifact: unknown;
  assumptions: string[];
}

function rowToSaved(row: SavedBuildingRow): SavedBuilding {
  return {
    id: row.id, userEmail: row.userEmail, address: row.address,
    lat: row.lat, lon: row.lon, floorAreaM2: row.floorAreaM2,
    building: JSON.parse(row.buildingJson) as Building, createdAt: row.createdAt,
  };
}

function rowToRun(row: RunRow): SavedRun {
  return {
    id: row.id, buildingId: row.buildingId, capturedAt: row.capturedAt,
    artifact: JSON.parse(row.artifactJson), assumptions: JSON.parse(row.assumptionsJson) as string[],
  };
}

export function saveBuilding(input: {
  id: string; userEmail: string; address: string; lat: number; lon: number;
  floorAreaM2: number; building: Building; createdAt: number;
}, database?: Db) {
  const db = database ?? getDb();
  const store = db.read();
  const savedBuildings = store.savedBuildings.filter((b) => b.id !== input.id);
  savedBuildings.push({
    id: input.id, userEmail: input.userEmail, address: input.address,
    lat: input.lat, lon: input.lon, floorAreaM2: input.floorAreaM2,
    buildingJson: JSON.stringify(input.building), createdAt: input.createdAt,
  });
  db.write({ ...store, savedBuildings });
}

export function getBuilding(id: string, database?: Db): SavedBuilding | null {
  const row = (database ?? getDb()).read().savedBuildings.find((b) => b.id === id);
  return row ? rowToSaved(row) : null;
}

export function listBuildingsForUser(userEmail: string, database?: Db): SavedBuilding[] {
  return (database ?? getDb()).read().savedBuildings
    .filter((b) => b.userEmail === userEmail)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(rowToSaved);
}

export function getLatestBuildingForUser(userEmail: string, database?: Db): SavedBuilding | null {
  return listBuildingsForUser(userEmail, database)[0] ?? null;
}

export function saveRun(input: {
  id: string; buildingId: string; capturedAt: number; artifact: unknown; assumptions: string[];
}, database?: Db) {
  const db = database ?? getDb();
  const store = db.read();
  const runs = store.runs.filter((r) => r.id !== input.id);
  runs.push({
    id: input.id, buildingId: input.buildingId, capturedAt: input.capturedAt,
    artifactJson: JSON.stringify(input.artifact), assumptionsJson: JSON.stringify(input.assumptions),
  });
  db.write({ ...store, runs });
}

export function getLatestRun(buildingId: string, database?: Db): SavedRun | null {
  const rows = (database ?? getDb()).read().runs
    .filter((r) => r.buildingId === buildingId)
    .sort((a, b) => b.capturedAt - a.capturedAt);
  return rows[0] ? rowToRun(rows[0]) : null;
}
