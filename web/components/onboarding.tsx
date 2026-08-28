'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Candidate } from '@/app/api/geocode/route';
import type { CaptureGeometry, CaptureJob, Stage } from '@/lib/capture-store';
import { cToF } from '@/lib/data';
import { cn } from '@/lib/cn';
import { BlockMap } from './block-map';

/**
 * Phase 1 — Advisory. The self-serve path from docs/flows/product-flow.md.
 *
 * The market onboards: qualify → site survey → install → point mapping →
 * learn 6 to 8 weeks → shadow → autonomy. Ours inverts that, because our
 * intelligence comes from outside the building and needs no learning period.
 *
 * This runs a **real** FortyGuard capture against the address that gets typed.
 * It is not a replay: a walkthrough that showed one recorded building to every
 * visitor would be a demo pretending to be a product. `/replay` is where the
 * committed fixture belongs, and determinism.md governs that page, not this one.
 *
 * Persistence, auth, and the BMS connection are Phases 2 to 4 and are not built.
 */

const STEPS = ['Address', 'Your block', 'Your day'] as const;

const STAGE_LABEL: Record<Stage, string> = {
  geocoding: 'Finding the address',
  heatmap: 'Requesting the heatmap for your block',
  'reading-tile': 'Reading the tile over your roof',
  parameters: 'Pulling twelve hours of parameters for that tile',
  deciding: 'Running the policies against your envelope',
  done: 'Done',
  failed: 'Failed',
};
const ORDER: Stage[] = ['geocoding', 'heatmap', 'reading-tile', 'parameters', 'deciding'];

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [address, setAddress] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [picked, setPicked] = useState<Candidate | null>(null);
  const [searching, setSearching] = useState(false);
  const [area, setArea] = useState('14200');
  const [job, setJob] = useState<CaptureJob | null>(null);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [geometry, setGeometry] = useState<CaptureGeometry | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const running = job !== null && job.stage !== 'done' && job.stage !== 'failed';

  /**
   * Search on a pause in typing. Nominatim asks for at most one request per
   * second, and a request per keystroke would breach that immediately.
   */
  useEffect(() => {
    const q = address.trim();
    if (q.length < 4 || picked) { setCandidates([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
        const body = await r.json();
        setCandidates(body.candidates ?? []);
      } finally { setSearching(false); }
    }, 450);
    return () => clearTimeout(t);
  }, [address, picked]);

  const start = useCallback(async () => {
    setError(''); setJob(null); setGeometry(null); setElapsed(0); setStep(1);
    const r = await fetch('/api/capture', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: picked?.label ?? address, floorAreaM2: Number(area),
        ...(picked ? { lat: picked.lat, lon: picked.lon } : {}),
      }),
    });
    const body = await r.json();
    if (!r.ok) { setError(body.error ?? 'That capture could not be started.'); setStep(0); return; }
    setJob(body);
  }, [address, area, picked]);

  // Poll while a capture is in flight. Two async FortyGuard tasks, about two minutes.
  useEffect(() => {
    if (!job || !running) return;
    const id = job.id;
    const tick = setInterval(async () => {
      setElapsed((s) => s + 1);
      const r = await fetch(`/api/capture?id=${id}`);
      if (!r.ok) return;
      const next: CaptureJob = await r.json();
      setJob(next);
      if (next.stage === 'done') setStep(2);
    }, 2000);
    timer.current = tick;
    return () => clearInterval(tick);
  }, [job, running]);

  // Fetched once rather than on every poll: ~500 polygons is far too much to
  // ship sixty times over a two minute capture.
  useEffect(() => {
    if (!job?.preview || geometry) return;
    let live = true;
    fetch(`/api/capture?id=${job.id}&geometry=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((g: CaptureGeometry | null) => { if (live && g) setGeometry(g); })
      .catch(() => {});
    return () => { live = false; };
  }, [job?.preview, job?.id, geometry]);

  const reached = (s: Stage) =>
    job ? ORDER.indexOf(job.stage) >= ORDER.indexOf(s) || job.stage === 'done' : false;

  return (
    <div className="w-full max-w-[1120px]">
      <ol className="mb-6 flex flex-wrap items-center gap-2 font-mono text-xs">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <span className={cn(
              'ease-fluid flex items-center gap-2 rounded-full border px-3 py-1 transition-colors duration-500',
              i === step ? 'border-safe text-safe'
                : i < step ? 'border-line text-fg-3' : 'border-line text-fg-3 opacity-50',
            )}>
              <i className={cn('block size-1.5 rounded-full', i <= step ? 'bg-safe' : 'bg-line-2')} />
              {label}
            </span>
            {i < STEPS.length - 1 ? <span className="text-fg-3">→</span> : null}
          </li>
        ))}
      </ol>

      <div className="rounded-2xl border border-line bg-surface p-2">
        <div className="overflow-hidden rounded-lg border border-line bg-ink">

          {step === 0 ? (
            <Panel title="WHERE IS THE BUILDING"
              note="No hardware, no site survey, no BMS credentials. We geocode this, bind it to a FortyGuard segment, and pull the real forecast for that segment.">
              <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
                <div className="relative block">
                  <label className="block">
                    <span className="font-mono text-xs tracking-wider text-fg-3">STREET ADDRESS (US)</span>
                    <input
                      value={address}
                      onChange={(e) => { setAddress(e.target.value); setPicked(null); }}
                      placeholder="233 S Wacker Dr, Chicago"
                      autoComplete="off"
                      className="ease-fluid mt-2 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-base text-fg transition-colors duration-500 outline-none placeholder:text-fg-3 focus-visible:border-safe"
                    />
                  </label>

                  {picked ? (
                    <p className="mt-2 flex flex-wrap items-center gap-2 font-mono text-xs text-safe">
                      ✓ {picked.label}
                      <button type="button" onClick={() => { setPicked(null); setAddress(''); }}
                        className="text-fg-3 underline underline-offset-2 hover:text-fg-2">change</button>
                    </p>
                  ) : candidates.length > 0 ? (
                    <ul className="mt-2 overflow-hidden rounded-lg border border-line bg-surface-2">
                      {candidates.map((c) => (
                        <li key={`${c.lat},${c.lon}`}>
                          <button
                            type="button"
                            onClick={() => { setPicked(c); setAddress(c.label); setCandidates([]); }}
                            className="ease-fluid block w-full border-b border-line px-3 py-2 text-left transition-colors duration-300 last:border-b-0 hover:bg-surface"
                          >
                            <span className="block text-sm text-fg-2">{c.label}</span>
                            <span className="block font-mono text-xs text-fg-3">
                              {c.kind} · {c.lat.toFixed(4)}, {c.lon.toFixed(4)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : searching ? (
                    <p className="mt-2 font-mono text-xs text-fg-3">SEARCHING…</p>
                  ) : null}
                </div>
                <label className="block">
                  <span className="font-mono text-xs tracking-wider text-fg-3">FLOOR AREA (m²)</span>
                  <input
                    value={area} onChange={(e) => setArea(e.target.value)} inputMode="numeric"
                    className="ease-fluid mt-2 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-base text-fg transition-colors duration-500 outline-none focus-visible:border-safe"
                  />
                </label>
              </div>
              {error ? <p className="mt-3 text-sm text-alert">{error}</p> : null}
              <button type="button" onClick={() => void start()} disabled={!picked}
                className="ease-fluid mt-4 rounded-full bg-fg px-3 py-2 text-base font-semibold text-ink transition-all duration-500 hover:bg-fg-2 active:scale-[0.98] disabled:opacity-30">
                {picked ? 'Capture this building' : 'Choose an address above'}
              </button>
              <p className="mt-3 text-xs text-fg-3">
                We do not ask for a setpoint. Assuming one cost 41% more energy against an independent
                emulator — it gets read from the building during the shadow phase.
              </p>
            </Panel>
          ) : null}

          {step >= 1 ? (
            <>
              <Panel title={job?.preview ? 'YOUR BLOCK' : 'CAPTURING'}
                note={job?.preview
                  ? `${job.preview.sourceTiles.toLocaleString()} real FortyGuard tiles over ${job.preview.address}. Point at any block to read its temperature; the ring is your building.`
                  : 'Two async FortyGuard tasks, roughly two minutes. Nothing here is cached and nothing is replayed.'}>
                <ol className="space-y-1.5">
                  {ORDER.map((s) => (
                    <li key={s} className="flex items-center gap-2 font-mono text-xs">
                      <i className={cn('block size-1.5 flex-none rounded-full',
                        job?.stage === s && running ? 'animate-pulse bg-safe'
                          : reached(s) ? 'bg-safe' : 'bg-line-2')} />
                      <span className={reached(s) ? 'text-fg-2' : 'text-fg-3'}>{STAGE_LABEL[s]}</span>
                    </li>
                  ))}
                </ol>
                {running ? (
                  <p className="tabular mt-3 font-mono text-xs text-fg-3">{elapsed * 2}s elapsed</p>
                ) : null}
                {job?.stage === 'failed' ? (
                  <div className="mt-3">
                    <p className="text-sm text-alert">{job.error}</p>
                    <button type="button" onClick={() => { setJob(null); setStep(0); }}
                      className="ease-fluid mt-3 rounded-full border border-line-2 px-3 py-2 text-sm font-semibold transition-all duration-500 hover:border-fg-3">
                      Try another address
                    </button>
                  </div>
                ) : null}
                {job?.preview ? (
                  <div className="mt-3 space-y-1 font-mono text-xs text-fg-2">
                    <p>
                      bound to {job.preview.lat.toFixed(4)}, {job.preview.lon.toFixed(4)} ·{' '}
                      {cToF(job.preview.tileTemperatureC).toFixed(1)} °F on your square ·{' '}
                      {job.preview.timezone}
                    </p>
                    {job.preview.buildingMinC !== undefined && job.preview.buildingMaxC !== undefined ? (
                      <p className="text-fg-3">
                        your square alone ranged {cToF(job.preview.buildingMinC).toFixed(1)} to{' '}
                        {cToF(job.preview.buildingMaxC).toFixed(1)} °F over the window
                      </p>
                    ) : null}
                    {job.preview.stats ? (
                      <p className="text-fg-3">
                        across the grid: {cToF(job.preview.stats.minimum).toFixed(1)} to{' '}
                        {cToF(job.preview.stats.maximum).toFixed(1)} °F, mean{' '}
                        {cToF(job.preview.stats.mean).toFixed(1)} °F, standard deviation{' '}
                        {(job.preview.stats.standardDeviation * 9 / 5).toFixed(2)} °F —{' '}
                        <span className="text-fg-3/70">computed by FortyGuard, not by us</span>
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </Panel>
              {job?.preview && geometry ? (
                <div className="border-t border-line">
                  <BlockMap
                    geometry={geometry} lat={job.preview.lat} lon={job.preview.lon}
                    buildingC={job.preview.tileTemperatureC}
                  />
                </div>
              ) : null}
            </>
          ) : null}

          {step === 2 && job?.artifact ? (
            <div className="border-t border-line">
              <Panel title="YOUR DAY"
                note={`Captured ${job.artifact.date} for ${job.artifact.building.name}. Zero access to your building.`}>
                <dl className="grid gap-4 sm:grid-cols-3">
                  <Stat k="YOUR TILE"
                    v={`${cToF(job.artifact.tileTemperatureC).toFixed(1)} °F`}
                    n="at the captured minute" />
                  <Stat k="SPREAD ACROSS THE GRID"
                    v={`${(((job.preview?.maxC ?? 0) - (job.preview?.minC ?? 0)) * 9 / 5).toFixed(1)} °F`}
                    n="one citywide number serves all of it" />
                  <Stat k="DECISIONS PLANNED"
                    v={String(job.artifact.intervals.filter((i) => i.copilot.decisions.length).length)}
                    n="over the captured window" />
                </dl>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <a href={`/app?capture=${job.id}`}
                    className="ease-fluid inline-flex items-center gap-2 rounded-full bg-fg px-3 py-2 text-base font-semibold text-ink transition-all duration-500 hover:bg-fg-2 active:scale-[0.98]">
                    See today&rsquo;s plan
                  </a>
                  <a href="/app/connect"
                    className="ease-fluid inline-flex items-center gap-2 rounded-full border border-line-2 px-3 py-2 text-base font-semibold transition-all duration-500 hover:border-fg-3 active:scale-[0.98]">
                    Next: find its controls →
                  </a>
                </div>
                <p className="mt-3 max-w-[620px] text-xs text-pretty text-fg-3">
                  Everything above came from the address alone, with no access to the building. The
                  next step looks inside it. This capture is held for thirty minutes and is not
                  saved to an account yet.
                </p>
              </Panel>
            </div>
          ) : null}

        </div>
      </div>
    </div>
  );
}

function Panel({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <div className="p-4">
      <div className="font-mono text-xs tracking-wider text-fg-3">{title}</div>
      <p className="mt-1 mb-4 max-w-[620px] text-sm text-pretty text-fg-2">{note}</p>
      {children}
    </div>
  );
}

function Stat({ k, v, n }: { k: string; v: string; n: string }) {
  return (
    <div>
      <dt className="font-mono text-xs tracking-wider text-fg-3">{k}</dt>
      <dd className="tabular mt-1 font-mono text-xl font-medium tracking-tight">{v}</dd>
      <dd className="mt-0.5 text-xs text-fg-3">{n}</dd>
    </div>
  );
}
