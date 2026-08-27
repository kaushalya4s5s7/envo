/** Capture a real day into fixtures/. Usage: bun capture.ts <date> [start] [end] */
import { demoBuilding } from './src/building';
import { captureDay, writeFixture } from './src/weather/capture';

const [date = '2026-08-26', startTime = '06:00', endTime = '22:00'] = process.argv.slice(2);
const apiKey = process.env.FORTYGUARD_API_KEY;
if (!apiKey) throw new Error('set FORTYGUARD_API_KEY');

const captured = await captureDay({ apiKey, building: demoBuilding, date, startTime, endTime });
await writeFixture(`../fixtures/${captured.fixture.id}.json`, captured);

const aqi = captured.snapshots.map((s) => s.now.pm25Aqi);
console.log(`\n${captured.snapshots.length} intervals, ${captured.fixture.droppedReadings} dropped`);
console.log(`PM2.5 AQI  ${Math.min(...aqi).toFixed(1)} … ${Math.max(...aqi).toFixed(1)}`);
console.log(`apparent   ${Math.min(...captured.snapshots.map((s) => s.now.apparentTempF)).toFixed(1)} … ${Math.max(...captured.snapshots.map((s) => s.now.apparentTempF)).toFixed(1)} °F`);
