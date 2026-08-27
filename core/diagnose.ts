/**
 * M6 diagnostic. Answers, with evidence rather than inference:
 *   1. When exactly does sealing activate?
 *   2. What does CO2 do, hour by hour, after sealing?
 *   3. Does the 1100 ppm ceiling ever trigger?
 *   4. What if the ceiling is much lower?
 *   5. What if sealing is disabled entirely?
 *   6. What if we leave the setpoint to the emulator?
 *
 * Usage: bun diagnose.ts <variant>
 *   asis | co2-800 | co2-600 | no-seal | no-setpoint | builtin
 */
import { EnvSnapshot } from './src/contracts';
import { demoBuilding } from './src/building';
import type { Building } from './src/contracts';
import { airQualityPolicy, emptyLatches, precoolPolicy, type LatchMap, type PolicyContext } from './src/policies';
import { arbitrate } from './src/copilot';
import { BoptestClient, ZONES, damperCommandToInputs, kpiToMetrics, readZone, setpointCommandToInputs } from './src/bms/boptest';
import { AIR, COMFORT } from './src/utils';
import { log } from './src/observability';

log.setLevel('error');
const variant = process.argv[2] ?? 'asis';

const CONFIG: Record<string, { co2?: number; seal: boolean; driveSetpoint: boolean }> = {
  'asis':        { seal: true,  driveSetpoint: true },
  'co2-800':     { seal: true,  driveSetpoint: true, co2: 800 },
  'co2-600':     { seal: true,  driveSetpoint: true, co2: 600 },
  'no-seal':     { seal: false, driveSetpoint: true },
  'no-setpoint': { seal: true,  driveSetpoint: false },
  'builtin':     { seal: false, driveSetpoint: false },
  'asis-72':     { seal: true,  driveSetpoint: true },
  'no-seal-72':  { seal: false, driveSetpoint: true },
};
const cfg = CONFIG[variant];
/**
 * BOPTEST's medium office settles at 75.2 °F under its own controller. Reading
 * the building's setpoint rather than imposing ours is the whole point of the
 * shadow phase. `asis-72` keeps the old constant so the two are comparable.
 */
const NOMINAL_F = variant.endsWith('-72') ? 72 : 75.5;
const building: Building = { ...demoBuilding, nominalSetpointF: NOMINAL_F };
if (!cfg) throw new Error(`unknown variant ${variant}`);

// Disabling sealing: push the close thresholds out of reach rather than branching
// around the policy, so the policy under test is still the real one.
const overrides: Partial<typeof AIR> = {
  ...(cfg.co2 === undefined ? {} : { CO2_CEILING_PPM: cfg.co2 }),
  ...(cfg.seal ? {} : { PM25_AQI_CLOSE: 9_999, O3_AQI_CLOSE: 9_999 }),
};

const raw = await Bun.file('../fixtures/demo-nyc-001-2026-08-07.json').json();
const snapshots: EnvSnapshot[] = raw.snapshots.map((s: unknown) => EnvSnapshot.parse(s));

const c = new BoptestClient();
await c.select('multizone_office_simple_air');
const initial = await c.scenario({ electricity_price: 'dynamic', time_period: 'peak_cool_day' }) as
  { time_period?: Record<string, number> };
let last = initial.time_period ?? {};
await c.setStep(3600);

let latches: LatchMap = emptyLatches();
let setpointF: number | null = null;
let damper: number | null = null;
let prevKwh = 0;

console.log(`variant ${variant}  nominal ${NOMINAL_F}F  ${JSON.stringify(overrides)}\n`);
console.log('hr  local  o3   app  | oa   spF   | zoneF  CO2ppm  meanCO2 | kWh/h  purge?  decisions');
console.log('─'.repeat(104));

for (const [i, env] of snapshots.entries()) {
  const cor = readZone(last, 'Cor');
  const co2s = ZONES.map((z) => { try { return readZone(last, z).co2Ppm; } catch { return cor.co2Ppm; } });
  const meanCo2 = co2s.reduce((a, b) => a + b, 0) / co2s.length;

  const ctx: PolicyContext = {
    at: env.now.at, building, env,
    indoor: { pm25: 6, co2Ppm: meanCo2, zoneTempF: cor.tempF },
    actuators: { outsideAirFraction: damper ?? 0.2, setpointF: setpointF ?? NOMINAL_F, tint: {}, demandResponse: false },
    latches,
  };

  const aq = airQualityPolicy(ctx, overrides);
  const pc = cfg.driveSetpoint ? precoolPolicy(ctx) : { proposals: [], latches: {}, state: null };
  latches = { ...latches, ...aq.latches };
  const { commands, decisions } = arbitrate([...aq.proposals, ...pc.proposals], {
    at: env.now.at, buildingId: building.id, segmentId: env.segmentId,
  });

  for (const cmd of commands) {
    if (cmd.actuator === 'outside_air_damper') damper = cmd.outsideAirFraction;
    if (cmd.actuator === 'hvac_setpoint' && cfg.driveSetpoint) setpointF = cmd.setpointF;
  }

  const purge = commands.some((x) => x.actuator === 'outside_air_damper' && x.mode === 'purge');
  const localHr = String((env.now.at.getUTCHours() + 20) % 24).padStart(2, '0');
  const kpiNow = kpiToMetrics(await c.kpi());
  const hourly = (kpiNow.energyKwh ?? 0) - prevKwh; prevKwh = kpiNow.energyKwh ?? 0;

  console.log(
    `${String(i).padStart(2)}  ${localHr}:00  ${env.now.ozoneAqi.toFixed(0).padStart(3)}  ${env.now.apparentTempF.toFixed(0).padStart(4)} |` +
    ` ${(damper ?? -1) < 0 ? ' — ' : (damper as number).toFixed(1)}  ${setpointF === null ? '  — ' : setpointF.toFixed(1)} |` +
    ` ${cor.tempF.toFixed(1).padStart(5)}  ${cor.co2Ppm.toFixed(0).padStart(6)}  ${meanCo2.toFixed(0).padStart(7)} |` +
    ` ${hourly.toFixed(4)}  ${purge ? 'PURGE ' : '      '}  ${decisions.map((d) => d.policy).join('+') || '·'}`,
  );

  last = await c.advance({
    ...damperCommandToInputs(damper),
    ...setpointCommandToInputs(cfg.driveSetpoint ? setpointF : null),
  });
}

const m = kpiToMetrics(await c.kpi());
await c.stop().catch(() => {});
console.log(`\nTOTALS  ener ${m.energyKwh?.toFixed(4)}  cost ${m.costTotal?.toFixed(4)}  tdis ${m.thermalDiscomfort?.toFixed(2)}  idis ${m.airQualityDiscomfort?.toFixed(2)}`);
