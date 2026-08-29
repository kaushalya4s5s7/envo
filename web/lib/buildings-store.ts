import type { Building } from 'core/contracts';
import { getDb } from './db';

/**
 * Durable counterpart to web/lib/capture-store.ts. That store holds one
 * in-flight capture for 30 minutes; this one holds what an org has
 * captured, indefinitely, so `/app` and `/app/buildings` survive a reload.
 * Scoped by org, not by user — a teammate invited into the same org sees
 * the same buildings, which is the actual point of having an org at all.
 * See docs/decisions/product/operator-product-shape.md.
 */

export interface SavedBuilding {
  id: string;
  orgId: string;
  address: string;
  lat: number;
  lon: number;
  floorAreaM2: number;
  building: Building;
  createdBy: string;
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
  id: string; org_id: string; address: string; lat: number; lon: number;
  floor_area_m2: number; building_json: Building; created_by: string; created_at: string;
}

function rowToSaved(row: BuildingRow): SavedBuilding {
  return {
    id: row.id, orgId: row.org_id, address: row.address,
    lat: row.lat, lon: row.lon, floorAreaM2: row.floor_area_m2,
    building: row.building_json, createdBy: row.created_by, createdAt: Number(row.created_at),
  };
}

export async function saveBuilding(input: {
  id: string; orgId: string; address: string; lat: number; lon: number;
  floorAreaM2: number; building: Building; createdBy: string; createdAt: number;
}): Promise<void> {
  const sql = await getDb();
  await sql`
    INSERT INTO saved_buildings
      (id, org_id, address, lat, lon, floor_area_m2, building_json, created_by, created_at)
    VALUES (
      ${input.id}, ${input.orgId}, ${input.address}, ${input.lat}, ${input.lon},
      ${input.floorAreaM2}, ${sql.json(input.building)}, ${input.createdBy}, ${input.createdAt}
    )
    ON CONFLICT (id) DO UPDATE SET
      address = excluded.address, lat = excluded.lat, lon = excluded.lon,
      floor_area_m2 = excluded.floor_area_m2, building_json = excluded.building_json
  `;
}

export async function getBuilding(id: string): Promise<SavedBuilding | null> {
  const sql = await getDb();
  const [row] = await sql<BuildingRow[]>`SELECT * FROM saved_buildings WHERE id = ${id}`;
  return row ? rowToSaved(row) : null;
}

export async function listBuildingsForOrg(orgId: string): Promise<SavedBuilding[]> {
  const sql = await getDb();
  const rows = await sql<BuildingRow[]>`
    SELECT * FROM saved_buildings WHERE org_id = ${orgId} ORDER BY created_at DESC
  `;
  return rows.map(rowToSaved);
}

export async function getLatestBuildingForOrg(orgId: string): Promise<SavedBuilding | null> {
  const buildings = await listBuildingsForOrg(orgId);
  return buildings[0] ?? null;
}

export async function saveRun(input: {
  id: string; buildingId: string; capturedAt: number; artifact: unknown; assumptions: string[];
}): Promise<void> {
  const sql = await getDb();
  await sql`
    INSERT INTO runs (id, building_id, captured_at, artifact_json, assumptions_json)
    VALUES (
      ${input.id}, ${input.buildingId}, ${input.capturedAt},
      ${sql.json(JSON.parse(JSON.stringify(input.artifact)))}, ${sql.json(input.assumptions)}
    )
    ON CONFLICT (id) DO UPDATE SET
      captured_at = excluded.captured_at, artifact_json = excluded.artifact_json,
      assumptions_json = excluded.assumptions_json
  `;
}

export async function getLatestRun(buildingId: string): Promise<SavedRun | null> {
  const sql = await getDb();
  const [row] = await sql<
    { id: string; building_id: string; captured_at: string; artifact_json: unknown; assumptions_json: string[] }[]
  >`
    SELECT * FROM runs WHERE building_id = ${buildingId} ORDER BY captured_at DESC LIMIT 1
  `;
  if (!row) return null;
  return {
    id: row.id, buildingId: row.building_id, capturedAt: Number(row.captured_at),
    artifact: row.artifact_json, assumptions: row.assumptions_json,
  };
}

/** Every run for every building in an org, newest first — the raw material for reports.ts. */
export async function listRunsForOrg(orgId: string): Promise<Array<SavedRun & { buildingAddress: string }>> {
  const sql = await getDb();
  const rows = await sql<
    {
      id: string; building_id: string; captured_at: string; artifact_json: unknown;
      assumptions_json: string[]; address: string;
    }[]
  >`
    SELECT r.id, r.building_id, r.captured_at, r.artifact_json, r.assumptions_json, b.address
    FROM runs r JOIN saved_buildings b ON b.id = r.building_id
    WHERE b.org_id = ${orgId}
    ORDER BY r.captured_at DESC
  `;
  return rows.map((row) => ({
    id: row.id, buildingId: row.building_id, capturedAt: Number(row.captured_at),
    artifact: row.artifact_json, assumptions: row.assumptions_json, buildingAddress: row.address,
  }));
}
