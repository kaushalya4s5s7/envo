import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Arm, Experiment } from 'core/sandbox';

/**
 * In memory job store for live BOPTEST runs, plus the committed recorded run.
 *
 * A full three arm experiment is roughly twenty two minutes, because each arm
 * re initializes the Modelica model with a seven day warmup. So the recorded run
 * is what the page shows by default and a live run is opt in: a judge can watch
 * the agent actually drive the emulator, without the page being useless to
 * anyone unwilling to wait.
 */

export interface SandboxJob {
  id: string;
  startedAt: number;
  state: 'running' | 'done' | 'failed';
  arm: Arm | null;
  hour: number;
  total: number;
  phase: 'warmup' | 'stepping' | 'scoring' | null;
  error?: string;
  experiment?: Experiment;
}

const jobs = new Map<string, SandboxJob>();
const TTL_MS = 60 * 60_000;

export const createJob = (total: number): SandboxJob => {
  const job: SandboxJob = {
    id: crypto.randomUUID(), startedAt: Date.now(), state: 'running',
    arm: null, hour: 0, total, phase: null,
  };
  jobs.set(job.id, job);
  setTimeout(() => jobs.delete(job.id), TTL_MS).unref?.();
  return job;
};

export const getJob = (id: string) => jobs.get(id);
export const patchJob = (id: string, patch: Partial<SandboxJob>) => {
  const j = jobs.get(id);
  if (j) Object.assign(j, patch);
};

/**
 * Read at request time rather than imported, so the app builds before the first
 * experiment has ever been run and a stale bundle can never shadow a fresh run.
 */
export async function recordedRun(): Promise<Experiment | null> {
  try {
    const file = path.join(process.cwd(), 'lib', 'sandbox.json');
    return JSON.parse(await readFile(file, 'utf8')) as Experiment;
  } catch {
    return null;
  }
}

/** The committed day the experiment runs against. Read from `fixtures/`, not copied into `web`. */
export async function loadFixture(id = 'demo-nyc-001-2026-08-07') {
  const file = path.join(process.cwd(), '..', 'fixtures', `${id}.json`);
  return JSON.parse(await readFile(file, 'utf8')) as {
    fixture: { id: string; date: string };
    snapshots: unknown[];
  };
}

/** BOPTEST is a local Docker stack; absent is the normal case, not an error. */
export async function boptestReachable(baseUrl: string): Promise<boolean> {
  try {
    const r = await fetch(`${baseUrl}/testcases`, { signal: AbortSignal.timeout(2500) });
    return r.ok;
  } catch {
    return false;
  }
}
