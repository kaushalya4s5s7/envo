'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { Arm, Experiment } from 'core/sandbox';
import type { SandboxJob } from '@/lib/sandbox-store';
import { METRICS, deltas, verdict } from '@/lib/scorecard';
import { cn } from '@/lib/cn';

/**
 * Phase 2 — Sandbox. The agent drives a building we did not write.
 *
 * BOPTEST is the IBPSA and DOE building emulator. It runs the physics, and it
 * computes every KPI on this page. That is the point: everywhere else in this
 * product we score ourselves, and a judge is right to discount that.
 *
 * The losses stay on screen. A scorecard that only showed wins would be the
 * least believable thing we could put in front of anyone.
 */

const ARMS: Arm[] = ['builtin', 'citywide', 'copilot'];
const ARM_LABEL: Record<Arm, string> = {
  builtin: 'BOPTEST baseline',
  citywide: 'Citywide signal',
  copilot: 'Envelope Copilot',
};
const ARM_NOTE: Record<Arm, string> = {
  builtin: 'The emulator’s own published controller. The only arm we did not write.',
  citywide: 'Our actuators, driven on current conditions and a metro air quality average.',
  copilot: 'The same actuators, driven on the hyperlocal forecast for this segment.',
};

export function Sandbox() {
  const [recorded, setRecorded] = useState<Experiment | null>(null);
  const [available, setAvailable] = useState(false);
  const [job, setJob] = useState<SandboxJob | null>(null);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/sandbox')
      .then((r) => r.json())
      .then((d: { recorded: Experiment | null; emulatorAvailable: boolean }) => {
        setRecorded(d.recorded); setAvailable(d.emulatorAvailable); setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!job || job.state !== 'running') return;
    const id = job.id;
    const tick = setInterval(async () => {
      const r = await fetch(`/api/sandbox?id=${id}`);
      if (r.ok) setJob(await r.json());
    }, 3000);
    return () => clearInterval(tick);
  }, [job]);

  const start = useCallback(async () => {
    setError('');
    const r = await fetch('/api/sandbox', { method: 'POST' });
    const body = await r.json();
    if (!r.ok) { setError(body.error ?? 'Could not start a run.'); return; }
    setJob(body);
  }, []);

  const experiment = job?.experiment ?? recorded;
  const isLive = Boolean(job?.experiment);
  const running = job?.state === 'running';

  return (
    <div className="w-full max-w-[1120px] rounded-2xl border border-line bg-surface p-2">
      <div className="overflow-hidden rounded-lg border border-line bg-ink">

        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-4 py-3">
          <span className="font-mono text-xs text-fg-3">
            BOPTEST · <b className="font-medium text-fg-2">{experiment?.testcase ?? 'multizone_office_simple_air'}</b>
            {experiment ? <> · {experiment.hours} h · peak cool day</> : null}
          </span>
          <span className={cn('font-mono text-xs', isLive ? 'text-safe' : 'text-fg-3')}>
            {isLive ? 'LIVE RUN — SCORED JUST NOW' : 'RECORDED RUN — COMMITTED'}
          </span>
        </header>

        <div className="border-b border-line p-4">
          <p className="max-w-[760px] text-base text-pretty text-fg md:text-lg">
            Anyone can claim their software saves energy. So we handed our agent a building we did
            not build, let it run a full day, and let <b>that</b> building do the scoring. Lower is
            better in every row below.
          </p>
          {experiment ? (
            <p className="mt-3 max-w-[760px] text-sm text-pretty text-fg-2">
              {verdict(experiment, 'citywide')}
            </p>
          ) : null}
        </div>

        {!loaded ? <p className="p-4 font-mono text-xs text-fg-3">LOADING…</p> : null}

        {loaded && !experiment ? (
          <p className="p-4 text-sm text-pretty text-fg-3">
            No run has been recorded yet. Run <code className="font-mono text-fg-2">bun sandbox.ts</code> in
            core with the emulator up.
          </p>
        ) : null}

        {experiment ? (
          <div className="overflow-x-auto border-b border-line">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-4 py-3 text-left font-mono text-xs font-normal tracking-wider text-fg-3">
                    SCORED BY THE EMULATOR
                  </th>
                  {ARMS.map((a) => (
                    <th key={a} className={cn('px-4 py-3 text-right text-sm font-medium',
                      a === 'copilot' ? 'text-fg' : 'text-fg-2')}>
                      {ARM_LABEL[a]}
                      <span className="mt-0.5 block max-w-[190px] text-xs font-normal text-pretty text-fg-3">
                        {ARM_NOTE[a]}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {METRICS.map((m) => {
                  const values = ARMS.map((a) => m.get(experiment, a));
                  const best = Math.min(...values.filter((v): v is number => v !== null));
                  return (
                    <tr key={m.key} className="border-b border-line last:border-b-0">
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="text-fg-2">{m.label}</span>
                          <span className="font-mono text-xs text-fg-3">{m.unit}</span>
                          <span className="font-mono text-xs text-fg-3/60">{m.raw}</span>
                        </div>
                        <p className="mt-0.5 max-w-[380px] text-xs text-pretty text-fg-3">{m.hint}</p>
                      </td>
                      {values.map((v, i) => (
                        <td key={ARMS[i]}
                          className={cn('tabular px-4 py-3 text-right font-mono',
                            v !== null && v === best ? 'text-safe' : 'text-fg-2')}>
                          {v === null ? 'n/a' : v.toFixed(m.decimals)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                <tr className="border-t border-line">
                  <td className="px-4 py-3 text-fg-2">Max zone temperature<span className="ml-2 font-mono text-xs text-fg-3">°F</span></td>
                  {ARMS.map((a) => (
                    <td key={a} className="tabular px-4 py-3 text-right font-mono text-fg-2">
                      {experiment.arms[a].maxZoneF.toFixed(1)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-3 text-fg-2">Hours on reduced intake</td>
                  {ARMS.map((a) => (
                    <td key={a} className="tabular px-4 py-3 text-right font-mono text-fg-2">
                      {experiment.arms[a].reducedIntakeHours}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}

        {experiment ? (
          <div className="grid gap-4 border-b border-line p-4 sm:grid-cols-2">
            {(['citywide', 'builtin'] as const).map((base) => (
              <div key={base}>
                <div className="font-mono text-xs tracking-wider text-fg-3">
                  COPILOT VS {ARM_LABEL[base].toUpperCase()}
                </div>
                <ul className="mt-2 space-y-1">
                  {deltas(experiment, base).map((d) => (
                    <li key={d.key} className="flex items-baseline justify-between gap-4 text-sm">
                      <span className="text-fg-3">{d.label}</span>
                      <span className={cn('tabular font-mono',
                        d.negligible ? 'text-fg-3' : d.better ? 'text-safe' : 'text-alert')}>
                        {d.negligible ? 'no change'
                          : `${Math.abs(d.percent).toFixed(1)}% ${d.percent > 0 ? 'more' : 'less'}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-4 border-b border-line p-4">
          <button
            type="button" onClick={() => void start()} disabled={!available || running}
            className="ease-fluid rounded-full bg-fg px-3 py-2 text-sm font-semibold text-ink transition-all duration-500 hover:bg-fg-2 active:scale-[0.98] disabled:opacity-30"
          >
            {running ? 'Running…' : 'Run it live'}
          </button>
          {running && job ? (
            <span className="tabular font-mono text-xs text-fg-2">
              {job.arm ?? '—'} · {job.phase} · {job.hour}/{job.total}
            </span>
          ) : null}
          {!available && loaded ? (
            <span className="max-w-[560px] text-xs text-pretty text-fg-3">
              No emulator reachable, so the committed run is shown. Start it with{' '}
              <code className="font-mono text-fg-2">docker compose up web worker provision</code>.
            </span>
          ) : null}
          {available && !running && !job ? (
            <span className="text-xs text-fg-3">
              Roughly seven minutes per arm. Each one re initialises the model with a seven day warmup.
            </span>
          ) : null}
          {error ? <span className="text-sm text-alert">{error}</span> : null}
          {job?.state === 'failed' ? <span className="text-sm text-alert">{job.error}</span> : null}
        </div>

        <div className="flex flex-wrap items-center gap-4 border-b border-line p-4">
          <Link href="/app/autonomy"
            className="ease-fluid inline-flex items-center gap-2 rounded-full bg-fg px-3 py-2 text-sm font-semibold text-ink transition-all duration-500 hover:bg-fg-2 active:scale-[0.98]">
            Next: grant control →
          </Link>
        </div>

        <p className="p-4 text-xs text-pretty text-fg-3">
          BOPTEST computes every KPI above from its own physics. We supply setpoint and damper
          commands and nothing else. Losses are shown because they are what the emulator returned,
          and because this harness is what caught our own twin ramping CO₂ at more than twice the
          emulator’s rate.
        </p>

      </div>
    </div>
  );
}
