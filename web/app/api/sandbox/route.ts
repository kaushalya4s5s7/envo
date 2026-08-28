import { NextResponse } from 'next/server';
import { EnvSnapshot } from 'core/contracts';
import { runExperiment } from 'core/sandbox';
import {
  boptestReachable, createJob, getJob, loadFixture, patchJob, recordedRun,
} from '@/lib/sandbox-store';

export const runtime = 'nodejs';
export const maxDuration = 3600;

const BASE = process.env['BOPTEST_URL'] ?? 'http://127.0.0.1:8000';

/**
 * Drive BOPTEST live, or serve the committed run when no emulator is reachable.
 *
 * The scoring here is not ours. That is the whole reason this endpoint exists,
 * and it is why the losing numbers stay in the response.
 */

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = params.get('id');

  if (id) {
    const job = getJob(id);
    if (!job) return NextResponse.json({ error: 'That run has expired.' }, { status: 404 });
    return NextResponse.json(job);
  }

  const [recorded, live] = await Promise.all([recordedRun(), boptestReachable(BASE)]);
  return NextResponse.json({ recorded, emulatorAvailable: live });
}

export async function POST() {
  if (!(await boptestReachable(BASE))) {
    return NextResponse.json(
      { error: `No BOPTEST emulator at ${BASE}. Start it with "docker compose up web worker provision".` },
      { status: 503 },
    );
  }

  const fixture = await loadFixture();
  const snapshots = fixture.snapshots.map((s) => EnvSnapshot.parse(s));
  const job = createJob(snapshots.length);

  void (async () => {
    try {
      const experiment = await runExperiment(fixture.fixture.id, {
        snapshots, baseUrl: BASE,
        scenario: {
          electricityPrice: 'dynamic', timePeriod: 'peak_cool_day',
          tempUncertainty: null, solarUncertainty: null, seed: 42,
        },
        onProgress: ({ arm, hour, total, phase }) => patchJob(job.id, { arm, hour, total, phase }),
      });
      patchJob(job.id, { state: 'done', experiment });
    } catch (e) {
      patchJob(job.id, { state: 'failed', error: e instanceof Error ? e.message : String(e) });
    }
  })();

  return NextResponse.json({ id: job.id });
}
