import type { Artifact } from 'core/copilot/artifact';
import { listRunsForOrg } from './buildings-store';

/**
 * Modeled, not measured — docs/decisions/product/honesty-rails.md. This
 * aggregates what each captured run's twin already computed at capture time.
 * It is not a priced attribution report against real shadow-mode data,
 * because no real BMS connection exists yet to produce one. Stated as a
 * fact, not hedged, per operator-product-shape.md's "still open" list.
 */

export interface BuildingReportRow {
  buildingId: string;
  address: string;
  captures: number;
  totalDaySavedKwh: number;
  averagePercentSaved: number;
  totalDecisions: number;
  lastCapturedAt: number;
}

export interface OrgReport {
  buildings: BuildingReportRow[];
  totals: {
    captures: number;
    totalDaySavedKwh: number;
    averagePercentSaved: number;
    totalDecisions: number;
  };
}

export async function buildOrgReport(orgId: string): Promise<OrgReport> {
  const runs = await listRunsForOrg(orgId);

  const byBuilding = new Map<
    string,
    { address: string; rows: Array<{ savedKwh: number; percentSaved: number; decisions: number; capturedAt: number }> }
  >();

  for (const run of runs) {
    const artifact = run.artifact as Artifact | undefined;
    const metrics = artifact?.metrics;
    if (!metrics) continue;

    const savedKwh = metrics.dayKwh.baseline - metrics.dayKwh.copilot;
    const percentSaved = metrics.dayKwh.baseline > 0 ? (savedKwh / metrics.dayKwh.baseline) * 100 : 0;
    const decisions = (artifact?.intervals ?? []).reduce((n, i) => n + i.copilot.decisions.length, 0);

    const bucket = byBuilding.get(run.buildingId) ?? { address: run.buildingAddress, rows: [] };
    bucket.rows.push({ savedKwh, percentSaved, decisions, capturedAt: run.capturedAt });
    byBuilding.set(run.buildingId, bucket);
  }

  const buildings: BuildingReportRow[] = [...byBuilding.entries()]
    .map(([buildingId, { address, rows }]) => ({
      buildingId,
      address,
      captures: rows.length,
      totalDaySavedKwh: +rows.reduce((s, r) => s + r.savedKwh, 0).toFixed(1),
      averagePercentSaved: +(rows.reduce((s, r) => s + r.percentSaved, 0) / rows.length).toFixed(1),
      totalDecisions: rows.reduce((s, r) => s + r.decisions, 0),
      lastCapturedAt: Math.max(...rows.map((r) => r.capturedAt)),
    }))
    .sort((a, b) => b.lastCapturedAt - a.lastCapturedAt);

  const totalCaptures = buildings.reduce((s, b) => s + b.captures, 0);
  const totals = {
    captures: totalCaptures,
    totalDaySavedKwh: +buildings.reduce((s, b) => s + b.totalDaySavedKwh, 0).toFixed(1),
    averagePercentSaved: totalCaptures > 0
      ? +(buildings.reduce((s, b) => s + b.averagePercentSaved * b.captures, 0) / totalCaptures).toFixed(1)
      : 0,
    totalDecisions: buildings.reduce((s, b) => s + b.totalDecisions, 0),
  };

  return { buildings, totals };
}
