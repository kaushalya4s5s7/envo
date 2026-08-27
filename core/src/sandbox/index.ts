import type { EnvSnapshot } from '../contracts';
import { demoBuilding } from '../building';
import {
  airQualityPolicy, emptyLatches, precoolPolicy, tintPolicy,
  type LatchMap, type PolicyContext,
} from '../policies';
import { arbitrate } from '../copilot';
import {
  BoptestClient, ZONES, damperCommandToInputs, kpiToMetrics, readZone, setpointCommandToInputs,
  type Zone,
} from '../bms/boptest';
import { AIR, COMFORT } from '../utils';

/**
 * Drive BOPTEST with the agent and let the emulator score the result.
 *
 * FortyGuard drives the decisions. BOPTEST drives the physics and computes every
 * KPI. This is the only place in the project where the scoring is not ours, and
 * that is the entire point of it existing.
 *
 * Extracted from the CLI so the product surface and the script run the identical
 * experiment. They must not drift: a page showing different numbers from the
 * committed run would make both uncheckable.
 */

/**
 * Three arms:
 *
 *   builtin  — no overrides at all. BOPTEST's own published baseline controller.
 *   citywide — our actuators, driven on a degraded signal: no forecast, metro
 *              air quality. A conventional controller with a citywide feed.
 *   copilot  — the same actuators, driven on the full hyperlocal signal.
 *
 * `builtin` matters because it is the only arm we did not write.
 *
 * **Both controlled arms engage their actuators from the first hour.** An
 * earlier version left the citywide arm's setpoint and damper unset, so no
 * policy ever fired on a degraded signal and every point stayed with BOPTEST —
 * which made `citywide` identical to `builtin` to four decimals on every KPI,
 * and turned the headline comparison into "our loop against no control at all".
 */
export type Arm = 'builtin' | 'citywide' | 'copilot';
export const ARMS: Arm[] = ['builtin', 'citywide', 'copilot'];

/** What a citywide feed reports while a plume sits on one block. */
const CITYWIDE_AQI = 38;

export interface ArmHour {
  hour: number;
  at: string;
  /** Core zone, kept for the scorecard's existing summary numbers. */
  zoneTempF: number;
  co2Ppm: number;
  /**
   * Every zone the building has, so the operations view shows the actual
   * building rather than one representative room. The perimeter zones diverge
   * from the core by several degrees, and that divergence is the whole reason
   * a facade aware agent has anything to say.
   */
  zones: Record<Zone, { tempF: number; co2Ppm: number }>;
  setpointF: number | null;
  outsideAirFraction: number | null;
  decisions: { policy: string; actuator: string; rationale: string }[];
}

export interface ArmResult {
  arm: Arm;
  metrics: ReturnType<typeof kpiToMetrics>;
  reducedIntakeHours: number;
  maxZoneF: number;
  meanZoneF: number;
  hours: ArmHour[];
}

export interface RunOptions {
  snapshots: EnvSnapshot[];
  testcase?: string;
  baseUrl?: string;
  scenario?: { electricityPrice?: string; timePeriod?: string; tempUncertainty?: string | null; solarUncertainty?: string | null; seed?: number };
  /** Called as the run progresses, so a caller can stream it. */
  onProgress?: (e: { arm: Arm; hour: number; total: number; phase: 'warmup' | 'stepping' | 'scoring' }) => void;
}

export async function runArm(arm: Arm, options: RunOptions): Promise<ArmResult> {
  const { snapshots, onProgress } = options;
  const sc = options.scenario ?? {};
  const client = new BoptestClient(options.baseUrl);

  onProgress?.({ arm, hour: 0, total: snapshots.length, phase: 'warmup' });
  await client.select(options.testcase ?? 'multizone_office_simple_air');

  // Setting `time_period` re initializes and returns initial measurements in the
  // payload. We seed from those: reading zone state before the first advance
  // would otherwise have nothing to read. This runs a seven day warmup and is
  // the slow part of the experiment, minutes rather than seconds.
  const initial = await client.scenario({
    electricity_price: sc.electricityPrice ?? 'dynamic',
    time_period: sc.timePeriod ?? 'peak_cool_day',
    temperature_uncertainty: sc.tempUncertainty ?? null,
    solar_uncertainty: sc.solarUncertainty ?? null,
    seed: sc.seed ?? 42,
  }) as { time_period?: Record<string, number> };
  let last: Record<string, number> = initial.time_period ?? {};
  await client.setStep(3600);

  let latches: LatchMap = emptyLatches();
  // `null` means "leave this point with BOPTEST". Only the builtin arm does that.
  const engaged = arm !== 'builtin';
  let setpointF: number | null = engaged ? COMFORT.SETPOINT_F : null;
  let damper: number | null = engaged ? AIR.NORMAL_OA_FRACTION : null;
  let reducedIntakeHours = 0;
  const zoneTemps: number[] = [];
  const hours: ArmHour[] = [];

  for (const [i, env] of snapshots.entries()) {
    onProgress?.({ arm, hour: i + 1, total: snapshots.length, phase: 'stepping' });

    // Citywide sees current conditions only, air quality flattened to a metro average.
    const seen: EnvSnapshot = arm === 'copilot' ? env : {
      ...env, forecast: [], now: { ...env.now, pm25Aqi: CITYWIDE_AQI, ozoneAqi: CITYWIDE_AQI },
    };

    const zone = readZone(last, 'Cor');
    const ctx: PolicyContext = {
      at: env.now.at, building: demoBuilding, env: seen,
      indoor: { pm25: 6, co2Ppm: zone.co2Ppm, zoneTempF: zone.tempF },
      actuators: {
        outsideAirFraction: damper ?? AIR.NORMAL_OA_FRACTION,
        setpointF: setpointF ?? COMFORT.SETPOINT_F,
        tint: {}, demandResponse: false,
      },
      latches,
    };

    // The builtin arm never proposes anything, so every point stays with BOPTEST.
    const results = arm === 'builtin'
      ? []
      : [airQualityPolicy(ctx), precoolPolicy(ctx), tintPolicy(ctx)];
    latches = results.reduce<LatchMap>((a, r) => ({ ...a, ...r.latches }), latches);
    const { commands, decisions } = arbitrate(results.flatMap((r) => r.proposals), {
      at: env.now.at, buildingId: demoBuilding.id, segmentId: env.segmentId,
    });

    for (const cmd of commands) {
      if (cmd.actuator === 'outside_air_damper') damper = cmd.outsideAirFraction;
      if (cmd.actuator === 'hvac_setpoint') setpointF = cmd.setpointF;
    }
    // Below normal, not zero: the policy holds SEAL_OA_FRACTION rather than
    // shutting. The null check is load bearing — `null < 0.2` is true in JS, so
    // omitting it counts every hour of the untouched builtin arm as reduced.
    if (damper !== null && damper < AIR.NORMAL_OA_FRACTION) reducedIntakeHours++;

    last = await client.advance({
      ...damperCommandToInputs(damper), ...setpointCommandToInputs(setpointF),
    });
    const after = readZone(last, 'Cor');
    zoneTemps.push(after.tempF);
    const zones = Object.fromEntries(ZONES.map((z) => {
      const r = readZone(last, z);
      return [z, { tempF: +r.tempF.toFixed(1), co2Ppm: Math.round(r.co2Ppm) }];
    })) as Record<Zone, { tempF: number; co2Ppm: number }>;
    hours.push({
      hour: i, at: env.now.at.toISOString(),
      zoneTempF: +after.tempF.toFixed(1), co2Ppm: Math.round(after.co2Ppm), zones,
      setpointF, outsideAirFraction: damper,
      decisions: decisions.map((d) => ({
        policy: d.policy, actuator: d.command.actuator, rationale: d.rationale,
      })),
    });
  }

  onProgress?.({ arm, hour: snapshots.length, total: snapshots.length, phase: 'scoring' });
  const metrics = kpiToMetrics(await client.kpi());
  await client.stop().catch(() => {});

  return {
    arm, metrics, reducedIntakeHours, hours,
    maxZoneF: +Math.max(...zoneTemps).toFixed(1),
    meanZoneF: +(zoneTemps.reduce((a, b) => a + b, 0) / zoneTemps.length).toFixed(1),
  };
}

export interface Experiment {
  ranAt: string;
  fixtureId: string;
  hours: number;
  testcase: string;
  scenario: Record<string, unknown>;
  arms: Record<Arm, ArmResult>;
}

export async function runExperiment(
  fixtureId: string, options: RunOptions,
): Promise<Experiment> {
  const arms = {} as Record<Arm, ArmResult>;
  for (const arm of ARMS) arms[arm] = await runArm(arm, options);
  return {
    ranAt: new Date().toISOString(),
    fixtureId,
    hours: options.snapshots.length,
    testcase: options.testcase ?? 'multizone_office_simple_air',
    scenario: { ...(options.scenario ?? {}) },
    arms,
  };
}
