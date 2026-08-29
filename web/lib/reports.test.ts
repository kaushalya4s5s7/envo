import { describe, test, expect, afterAll } from 'bun:test';
import { getDb } from './db';
import { saveBuilding, saveRun } from './buildings-store';
import { buildOrgReport } from './reports';
import type { Building } from 'core/contracts';

const building: Building = {
  id: 'live-1', name: 'Report Test Tower', segmentId: 'seg_1_1', lat: 1, lon: 1,
  floorAreaM2: 1000, nominalSetpointF: 72, thermalMassHours: 6,
  facades: [{ id: 'n', azimuthDeg: 0, glazedAreaM2: 50, tintable: true }],
};

/** Minimal shape reports.ts actually reads — not the full Artifact type. */
function fakeArtifact(copilotKwh: number, baselineKwh: number, decisionCount: number) {
  return {
    metrics: { dayKwh: { copilot: copilotKwh, baseline: baselineKwh } },
    intervals: [{ copilot: { decisions: Array.from({ length: decisionCount }, () => ({})) } }],
  };
}

const orgId = `test-org-${crypto.randomUUID()}`;
const userId = `test-user-${crypto.randomUUID()}`;
const buildingIds: string[] = [];

afterAll(async () => {
  const sql = await getDb();
  if (buildingIds.length) await sql`DELETE FROM runs WHERE building_id = ANY(${buildingIds})`;
  await sql`DELETE FROM saved_buildings WHERE org_id = ${orgId}`;
  await sql`DELETE FROM organizations WHERE id = ${orgId}`;
  await sql`DELETE FROM users WHERE id = ${userId}`;
});

describe('reports', () => {
  test('aggregates modeled savings and decisions across an org\'s captures', async () => {
    const sql = await getDb();
    await sql`INSERT INTO users (id, email, name, created_at) VALUES (${userId}, ${userId + '@example.com'}, null, ${Date.now()})`;
    await sql`INSERT INTO organizations (id, name, created_at) VALUES (${orgId}, 'Report Org', ${Date.now()})`;

    const buildingId = crypto.randomUUID();
    buildingIds.push(buildingId);
    await saveBuilding({
      id: buildingId, orgId, address: 'Report Test Address', lat: 1, lon: 1,
      floorAreaM2: 1000, building, createdBy: userId, createdAt: Date.now(),
    });

    // Day 1: 100 baseline, 80 copilot -> 20 kWh saved, 20%, 3 decisions.
    await saveRun({
      id: crypto.randomUUID(), buildingId, capturedAt: 1,
      artifact: fakeArtifact(80, 100, 3), assumptions: [],
    });
    // Day 2: 200 baseline, 150 copilot -> 50 kWh saved, 25%, 2 decisions.
    await saveRun({
      id: crypto.randomUUID(), buildingId, capturedAt: 2,
      artifact: fakeArtifact(150, 200, 2), assumptions: [],
    });

    const report = await buildOrgReport(orgId);
    const row = report.buildings.find((b) => b.buildingId === buildingId);
    expect(row?.captures).toBe(2);
    expect(row?.totalDaySavedKwh).toBeCloseTo(70, 1);
    expect(row?.averagePercentSaved).toBeCloseTo(22.5, 1);
    expect(row?.totalDecisions).toBe(5);

    expect(report.totals.captures).toBeGreaterThanOrEqual(2);
    expect(report.totals.totalDaySavedKwh).toBeGreaterThanOrEqual(70);
  });

  test('an org with nothing captured returns an empty, zeroed report', async () => {
    const report = await buildOrgReport('org-with-nothing-captured-report-test');
    expect(report.buildings).toEqual([]);
    expect(report.totals).toEqual({
      captures: 0, totalDaySavedKwh: 0, averagePercentSaved: 0, totalDecisions: 0,
    });
  });
});
