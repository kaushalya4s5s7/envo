import type {
  Building, Command, EnvSnapshot, RunArtifact, RunInterval, StrategyName,
} from '../contracts';
import { SimulatedBms, verify, type BmsAdapter } from '../bms';
import { airQualityPolicy, emptyLatches, precoolPolicy, tintPolicy, type LatchMap, type PolicyContext }
  from '../policies';
import { initialTwinState, stepTwin } from '../twin';
import { AIR, COMFORT, MAX_CHANGES_PER_HOUR, PRECOOL, TINT } from '../utils';
import { log } from '../observability';
import { arbitrate } from './arbiter';

/**
 * The control loop: sense, fuse, decide, actuate, verify.
 *
 * Both strategies run **this same loop**, against independent twins, over the
 * identical fixture. Only the signal differs. If the baseline were a separately
 * written naive controller, the comparison would be rigged and a judge would be
 * right to say so.
 */

const OCCUPANTS = 180;
/** What a citywide feed reports while a plume sits on one block. */
const CITYWIDE_AQI = 38;

/**
 * Reduce a hyperlocal snapshot to what a single citywide weather feed would carry:
 * current conditions only, air quality averaged across the metro, no forecast.
 *
 * Irradiance is deliberately left intact, so the copilot's advantage comes purely
 * from forecast and hyperlocal air quality rather than from a handicap.
 */
export function degradeSignal(env: EnvSnapshot): EnvSnapshot {
  return {
    ...env,
    now: { ...env.now, pm25Aqi: CITYWIDE_AQI, ozoneAqi: CITYWIDE_AQI },
    forecast: [],
    clearSky: env.clearSky,
  };
}

export interface ReplayInput {
  fixture: { id: string; synthetic: boolean };
  snapshots: EnvSnapshot[];
  building: Building;
}

export function runReplay(input: ReplayInput): RunArtifact {
  return {
    fixtureId: input.fixture.id,
    buildingId: input.building.id,
    synthetic: input.fixture.synthetic,
    generatedAt: new Date(),
    thresholds: { AIR, PRECOOL, TINT, COMFORT, MAX_CHANGES_PER_HOUR },
    strategies: {
      envelope_copilot: runStrategy('envelope_copilot', input.snapshots, (e) => e, input.building),
      baseline: runStrategy('baseline', input.snapshots, degradeSignal, input.building),
    },
  };
}

/**
 * `truth` drives the twin; `perceive` decides what the controller is allowed to
 * see. Both strategies experience the **same physical day** — only their signal
 * differs. Feeding a degraded snapshot into the twin would mean the baseline
 * building never actually met the plume, which would rig the comparison.
 */
function runStrategy(
  name: StrategyName,
  truth: EnvSnapshot[],
  perceive: (env: EnvSnapshot) => EnvSnapshot,
  building: Building,
): RunInterval[] {
  const snapshots = truth;
  const first = snapshots[0];
  if (!first) return [];

  const bms: BmsAdapter = new SimulatedBms();
  let twin = initialTwinState(first.now.at, COMFORT.SETPOINT_F);
  let latches: LatchMap = emptyLatches();
  const out: RunInterval[] = [];

  for (const actual of snapshots) {
    const at = actual.now.at;
    const env = perceive(actual);
    const ctx: PolicyContext = {
      at,
      building,
      env,
      indoor: { pm25: twin.indoorPm25, co2Ppm: twin.indoorCo2Ppm, zoneTempF: twin.zoneTempF },
      actuators: bms.state(),
      latches,
    };

    // DECIDE — policies propose, purely.
    const results = [airQualityPolicy(ctx), precoolPolicy(ctx), tintPolicy(ctx)];
    latches = results.reduce<LatchMap>((acc, r) => ({ ...acc, ...r.latches }), latches);
    const proposals = results.flatMap((r) => r.proposals);

    const { commands, decisions } = arbitrate(proposals, {
      at,
      buildingId: building.id,
      segmentId: actual.segmentId,
    });

    // ACTUATE — the BMS may refuse, and refusal is data.
    const applied: Command[] = [];
    for (const command of commands) {
      const result = bms.apply(command, at);
      if (result.accepted) applied.push(command);
      else log.debug('command not applied', { actuator: command.actuator, reason: result.reason });
    }

    // VERIFY — a command on a screen does not prove the actuator moved.
    for (const command of commands) {
      const divergence = verify(command, bms.state());
      if (divergence) log.warn('intent diverged from observed state', { strategy: name, ...divergence });
    }

    const state = bms.state();
    // The twin always sees the real day, never the degraded one.
    twin = stepTwin(twin, {
      at,
      outdoorTempF: actual.now.apparentTempF,
      outdoorPm25: aqiToRoughConcentration(actual.now.pm25Aqi),
      setpointF: state.setpointF,
      outsideAirFraction: state.outsideAirFraction,
      occupants: OCCUPANTS,
    });

    out.push({ at, commands: applied, decisions, twin });
  }

  return out;
}

/**
 * ⚠️ **Placeholder pending B6.**
 *
 * The twin works in µg/m³ because mixing AQI values linearly is physically wrong.
 * Converting properly needs the EPA piecewise breakpoint table, and the 2024
 * revision changed the PM2.5 breakpoints. Rather than guess at those numbers this
 * uses a single crude slope, which is enough to make the twin behave sensibly and
 * is **not** correct for any displayed figure.
 *
 * Replace with the real table before any number from it reaches a user.
 */
function aqiToRoughConcentration(aqi: number): number {
  return aqi * 0.5;
}
