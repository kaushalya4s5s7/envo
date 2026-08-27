import type { Building, EnvSnapshot } from '../contracts';
import { runReplay } from './index';
import { AIR } from '../utils/thresholds';

/**
 * Build the artifact the web app renders, from any day and any building.
 *
 * Extracted from the `bun artifact.ts` script so the live capture path and the
 * committed fixture path produce the identical shape. They must not drift: the
 * replay page is our reproducible proof, and a live capture that rendered
 * differently would quietly make the two incomparable.
 */

export interface ArtifactInput {
  fixture: Parameters<typeof runReplay>[0]['fixture'];
  snapshots: EnvSnapshot[];
  building: Building;
  capturedAt: string;
  date: string;
  tileTemperatureC: number;
}

export function buildArtifact(input: ArtifactInput) {
  const { snapshots, building } = input;
  const artifact = runReplay({ fixture: input.fixture, snapshots, building });

  // Both strategies always run; an empty one is a wiring bug, not a state.
  const c = artifact.strategies.envelope_copilot ?? [];
  const b = artifact.strategies.baseline ?? [];
  if (c.length !== snapshots.length || b.length !== snapshots.length) {
    throw new Error(`replay produced ${c.length}/${b.length} intervals for ${snapshots.length} snapshots`);
  }
  const peakIdx = snapshots.reduce(
    (best, s, i) => (s.now.apparentTempF > snapshots[best]!.now.apparentTempF ? i : best), 0);
  const lo = Math.max(0, peakIdx - 2);
  const hi = Math.min(snapshots.length - 1, peakIdx + 2);
  const window = (x: typeof c) => x[hi]!.twin.coolingKwh - x[lo]!.twin.coolingKwh;

  return {
    fixtureId: artifact.fixtureId,
    synthetic: artifact.synthetic,
    building: { name: building.name, lat: building.lat, lon: building.lon, segmentId: building.segmentId },
    capturedAt: input.capturedAt,
    date: input.date,
    tileTemperatureC: input.tileTemperatureC,
    peak: { index: peakIdx, from: lo, to: hi },
    metrics: {
      peakWindowKwh: { copilot: +window(c).toFixed(1), baseline: +window(b).toFixed(1) },
      dayKwh: { copilot: +c.at(-1)!.twin.coolingKwh.toFixed(1), baseline: +b.at(-1)!.twin.coolingKwh.toFixed(1) },
      /**
       * Hours the intake was held below its normal position. Not "sealed": the
       * air quality policy holds SEAL_OA_FRACTION rather than zero, on purpose,
       * so a pollutant event is never traded for CO2 buildup. Counting `=== 0`
       * here reported 0 during a real ozone event.
       */
      reducedIntakeHours: {
        copilot: c.filter((i) => i.twin.outsideAirFraction < AIR.NORMAL_OA_FRACTION).length,
        baseline: b.filter((i) => i.twin.outsideAirFraction < AIR.NORMAL_OA_FRACTION).length,
      },
      maxZoneF: {
        copilot: +Math.max(...c.map((i) => i.twin.zoneTempF)).toFixed(1),
        baseline: +Math.max(...b.map((i) => i.twin.zoneTempF)).toFixed(1),
      },
    },
    intervals: snapshots.map((s, i) => ({
      at: s.now.at.toISOString(),
      env: {
        apparentTempF: +s.now.apparentTempF.toFixed(1), wetBulbF: +s.now.wetBulbF.toFixed(1),
        pm25Aqi: +s.now.pm25Aqi.toFixed(0), ozoneAqi: +s.now.ozoneAqi.toFixed(0),
        cloudCoverPercent: s.now.cloudCoverPercent,
        // Carried so the sensing panel can show what the vendor actually
        // returned, rather than only the six parameters control depends on.
        ...(s.now.outdoorCo2Ppm === undefined ? {} : { outdoorCo2Ppm: s.now.outdoorCo2Ppm }),
        ...(s.now.ambient === undefined ? {} : { ambient: s.now.ambient }),
      },
      copilot: strategyAt(c, i),
      baseline: strategyAt(b, i),
    })),
  };
}

export type Artifact = ReturnType<typeof buildArtifact>;

function strategyAt(x: NonNullable<ReturnType<typeof runReplay>['strategies']['baseline']>, i: number) {
  const s = x[i]!;
  return {
    zoneTempF: +s.twin.zoneTempF.toFixed(1),
    massTempF: +s.twin.massTempF.toFixed(1),
    outsideAirFraction: s.twin.outsideAirFraction,
    coolingKwh: +s.twin.coolingKwh.toFixed(1),
    decisions: s.decisions.map((d) => ({
      policy: d.policy, actuator: d.command.actuator, rationale: d.rationale,
      reverseWhen: d.reverseWhen, trigger: d.trigger,
      conflictsOverridden: d.conflictsOverridden,
    })),
  };
}
