/** Build the replay artifact the web app renders. Usage: bun artifact.ts <fixture-id> */
import { EnvSnapshot } from './src/contracts';
import { demoBuilding } from './src/building';
import { buildArtifact } from './src/copilot/artifact';
import { log } from './src/observability';

log.setLevel('error');
const id = process.argv[2] ?? 'demo-nyc-001-2026-08-07';
const raw = await Bun.file(`../fixtures/${id}.json`).json();
const snapshots = raw.snapshots.map((s: unknown) => EnvSnapshot.parse(s));

const artifact = buildArtifact({
  fixture: raw.fixture, snapshots, building: demoBuilding,
  capturedAt: raw.fixture.capturedAt, date: raw.fixture.date,
  tileTemperatureC: raw.fixture.tileTemperatureC,
});

await Bun.write('../web/lib/artifact.json', JSON.stringify(artifact, null, 2) + '\n');

const { peak, metrics } = artifact;
console.log(`artifact written: ${snapshots.length} intervals, synthetic=${artifact.synthetic}`);
console.log(`peak window ${peak.from}..${peak.to}  copilot ${metrics.peakWindowKwh.copilot} vs baseline ${metrics.peakWindowKwh.baseline} kWh`);
