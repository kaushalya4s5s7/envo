/**
 * M6.4 — run the agent against BOPTEST and let the emulator score it.
 *
 * FortyGuard drives the decisions. BOPTEST drives the physics.
 * Usage: bun sandbox.ts <fixture-id> [hours] [tempUncertainty] [solarUncertainty] [seed]
 *
 * Writes `web/lib/sandbox.json` so the product surface can render this exact run
 * when no emulator is reachable. The page and this script share the experiment
 * in `src/sandbox`, so the two cannot report different numbers.
 */
import { EnvSnapshot } from './src/contracts';
import { ARMS, runExperiment, type Arm } from './src/sandbox';
import { log } from './src/observability';

log.setLevel('error');
const [fixtureId = 'demo-nyc-001-2026-08-07', hoursArg = '17', tUnc = 'none', sUnc = 'none', seed = '42'] =
  process.argv.slice(2);

const raw = await Bun.file(`../fixtures/${fixtureId}.json`).json();
const snapshots: EnvSnapshot[] = raw.snapshots
  .map((s: unknown) => EnvSnapshot.parse(s))
  .slice(0, Number(hoursArg));

console.log(`fixture ${fixtureId} · ${snapshots.length} h · uncertainty temp=${tUnc} solar=${sUnc} seed=${seed}\n`);

const experiment = await runExperiment(fixtureId, {
  snapshots,
  scenario: {
    electricityPrice: 'dynamic', timePeriod: 'peak_cool_day',
    tempUncertainty: tUnc === 'none' ? null : tUnc,
    solarUncertainty: sUnc === 'none' ? null : sUnc,
    seed: Number(seed),
  },
  onProgress: ({ arm, hour, total, phase }) =>
    process.stderr.write(`\r  ${arm.padEnd(9)} ${phase.padEnd(8)} ${hour}/${total}   `),
});
process.stderr.write('\n');

const out = experiment.arms;
const fmt = (n: number | null, d = 4) => (n === null ? 'n/a' : n.toFixed(d));
const row = (label: string, get: (r: typeof out[Arm]) => string) =>
  console.log(`${label.padEnd(24)}${ARMS.map((a) => get(out[a]).padStart(11)).join('')}`);

console.log(`${''.padEnd(24)}${ARMS.map((a) => a.padStart(11)).join('')}`);
console.log('─'.repeat(24 + 11 * ARMS.length));
row('energy   ener_tot', (r) => fmt(r.metrics.energyKwh, 4));
row('cost     cost_tot', (r) => fmt(r.metrics.costTotal, 4));
row('thermal  tdis_tot', (r) => fmt(r.metrics.thermalDiscomfort, 2));
row('air qual idis_tot', (r) => fmt(r.metrics.airQualityDiscomfort, 2));
row('reduced intake h', (r) => String(r.reducedIntakeHours));
row('max zone °F', (r) => r.maxZoneF.toFixed(1));
row('mean zone °F', (r) => r.meanZoneF.toFixed(1));

/**
 * Direction is stated in words. An earlier version printed `energy -97.5%`
 * under a "copilot vs citywide" heading for a run that used 97.5% MORE energy:
 * read quickly, a signed percentage next to "scored by BOPTEST" is taken for a
 * saving. Never print a bare signed percentage here.
 */
const delta = (label: string, mine: number | null, theirs: number | null, lowerIsBetter = true) => {
  if (mine === null || theirs === null || theirs === 0) return console.log(`  ${label.padEnd(14)} n/a`);
  const pct = ((mine - theirs) / Math.abs(theirs)) * 100;
  const better = lowerIsBetter ? pct < 0 : pct > 0;
  console.log(`  ${label.padEnd(14)} ${Math.abs(pct).toFixed(1)}% ${pct >= 0 ? 'more' : 'less'}` +
              `  ${Math.abs(pct) < 0.05 ? '(no change)' : better ? '← better' : '← worse'}`);
};

for (const base of ['citywide', 'builtin'] as const) {
  const c = out.copilot.metrics, b = out[base].metrics;
  console.log(`\ncopilot vs ${base}, scored by BOPTEST, not by us:`);
  delta('energy', c.energyKwh, b.energyKwh);
  delta('cost', c.costTotal, b.costTotal);
  delta('thermal disc', c.thermalDiscomfort, b.thermalDiscomfort);
  delta('air qual disc', c.airQualityDiscomfort, b.airQualityDiscomfort);
}

await Bun.write('../web/lib/sandbox.json', JSON.stringify(experiment, null, 2) + '\n');
console.log('\nwrote web/lib/sandbox.json');
