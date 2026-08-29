import type { Database } from 'bun:sqlite';
import type { Building } from 'core/contracts';
import { db as defaultDb } from './db';

/**
 * Durable counterpart to web/lib/capture-store.ts. That store holds one
 * in-flight capture for 30 minutes; this one holds what a signed-in user has
 * captured, indefinitely, so `/app` and `/app/buildings` survive a reload.
 * See docs/decisions/product/operator-product-shape.md.
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

interface BuildingRow {
  id: string; user_email: string; address: string; lat: number; lon: number;
  floor_area_m2: number; building_json: string; created_at: number;
}

function rowToSaved(row: BuildingRow): SavedBuilding {
  return {
    id: row.id, userEmail: row.user_email, address: row.address,
    lat: row.lat, lon: row.lon, floorAreaM2: row.floor_area_m2,
    building: JSON.parse(row.building_json) as Building, createdAt: row.created_at,
  };
}

export function saveBuilding(input: {
  id: string; userEmail: string; address: string; lat: number; lon: number;
  floorAreaM2: number; building: Building; createdAt: number;
}, database: Database = defaultDb) {
  database.query(`
    INSERT OR REPLACE INTO saved_building
      (id, user_email, address, lat, lon, floor_area_m2, building_json, created_at)
    VALUES ($id, $userEmail, $address, $lat, $lon, $floorAreaM2, $buildingJson, $createdAt)
  `).run({
    $id: input.id, $userEmail: input.userEmail, $address: input.address,
    $lat: input.lat, $lon: input.lon, $floorAreaM2: input.floorAreaM2,
    $buildingJson: JSON.stringify(input.building), $createdAt: input.createdAt,
  });
}

export function getBuilding(id: string, database: Database = defaultDb): SavedBuilding | null {
  const row = database.query('SELECT * FROM saved_building WHERE id = $id')
    .get({ $id: id }) as BuildingRow | null;
  return row ? rowToSaved(row) : null;
}

export function listBuildingsForUser(userEmail: string, database: Database = defaultDb): SavedBuilding[] {
  const rows = database.query(
    'SELECT * FROM saved_building WHERE user_email = $userEmail ORDER BY created_at DESC',
  ).all({ $userEmail: userEmail }) as BuildingRow[];
  return rows.map(rowToSaved);
}

export function getLatestBuildingForUser(userEmail: string, database: Database = defaultDb): SavedBuilding | null {
  const row = database.query(
    'SELECT * FROM saved_building WHERE user_email = $userEmail ORDER BY created_at DESC LIMIT 1',
  ).get({ $userEmail: userEmail }) as BuildingRow | null;
  return row ? rowToSaved(row) : null;
}

export function saveRun(input: {
  id: string; buildingId: string; capturedAt: number; artifact: unknown; assumptions: string[];
}, database: Database = defaultDb) {
  database.query(`
    INSERT OR REPLACE INTO run (id, building_id, captured_at, artifact_json, assumptions_json)
    VALUES ($id, $buildingId, $capturedAt, $artifactJson, $assumptionsJson)
  `).run({
    $id: input.id, $buildingId: input.buildingId, $capturedAt: input.capturedAt,
    $artifactJson: JSON.stringify(input.artifact), $assumptionsJson: JSON.stringify(input.assumptions),
  });
}

export function getLatestRun(buildingId: string, database: Database = defaultDb): SavedRun | null {
  const row = database.query(
    'SELECT * FROM run WHERE building_id = $buildingId ORDER BY captured_at DESC LIMIT 1',
  ).get({ $buildingId: buildingId }) as
    { id: string; building_id: string; captured_at: number; artifact_json: string; assumptions_json: string } | null;
  if (!row) return null;
  return {
    id: row.id, buildingId: row.building_id, capturedAt: row.captured_at,
    artifact: JSON.parse(row.artifact_json), assumptions: JSON.parse(row.assumptions_json) as string[],
  };
}
