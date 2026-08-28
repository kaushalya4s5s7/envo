'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Arm, Experiment } from 'core/sandbox';
import { cn } from '@/lib/cn';

/**
 * The building, as an operator would watch it.
 *
 * Every number here is physics from a real reference model — the US Department
 * of Energy medium office, five zones around a core, simulated by BOPTEST. It is
 * a **simulated** building and the header says so, but it is not a mock: the
 * temperatures diverge because of orientation and solar gain, and the CO₂ rises
 * because occupants breathe.
 *
 * This is the view that would point at a real BMS. What changes when it does is
 * the transport underneath, not this screen.
 */

const ARM_LABEL: Record<Arm, string> = {
  builtin: 'Building’s own controller',
  citywide: 'Citywide signal',
  copilot: 'Envelope Copilot',
};

/** Physical layout: perimeter zones by orientation, core in the middle. */
const GRID: (string | null)[][] = [
  [null, 'Nor', null],
  ['Wes', 'Cor', 'Eas'],
  [null, 'Sou', null],
];

const ZONE_NAME: Record<string, string> = {
  Nor: 'North', Sou: 'South', Eas: 'East', Wes: 'West', Cor: 'Core',
};

export function Building() {
  const [exp, setExp] = useState<Experiment | null>(null);
  const [arm, setArm] = useState<Arm>('copilot');
  const [hour, setHour] = useState(0);
  const [playing, setPlaying] = useState(false);
  // Distinguishes "still fetching" from "nothing recorded". Without it the page
  // server renders the empty state and flashes an error before data arrives.
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/sandbox')
      .then((r) => r.json())
      .then((d: { recorded: Experiment | null }) => setExp(d.recorded))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const hours = exp?.arms[arm].hours ?? [];

  useEffect(() => {
    if (!playing || hours.length === 0) return;
    const t = setInterval(() => {
      setHour((h) => {
        if (h + 1 >= hours.length) { setPlaying(false); return h; }
        return h + 1;
      });
    }, 900);
    return () => clearInterval(t);
  }, [playing, hours.length]);

  const now = hours[Math.min(hour, hours.length - 1)];
  const span = useMemo(() => {
    const all = hours.flatMap((h) => Object.values(h.zones ?? {}).map((z) => z.tempF));
    return all.length ? { min: Math.min(...all), max: Math.max(...all) } : { min: 68, max: 80 };
  }, [hours]);

  if (!exp || !now) {
    return (
      <div className="w-full max-w-[1120px] rounded-2xl border border-line bg-surface p-2">
        <p className="rounded-lg border border-line bg-ink p-4 font-mono text-xs text-fg-3">
          {loaded
            ? <>NO RECORDED RUN YET — run <span className="text-fg-2">bun sandbox.ts</span> in core.</>
            : 'LOADING THE BUILDING…'}
        </p>
      </div>
    );
  }

  const hasZones = Boolean(now.zones);

  return (
    <div className="w-full max-w-[1120px] rounded-2xl border border-line bg-surface p-2">
      <div className="overflow-hidden rounded-lg border border-line bg-ink">

        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-4 py-3">
          <span className="font-mono text-xs text-fg-3">
            MEDIUM OFFICE · 5 ZONES · <b className="font-medium text-fg-2">{exp.testcase}</b>
          </span>
          <span className="font-mono text-xs text-fg-3">
            SIMULATED BUILDING — NOT CONNECTED TO EQUIPMENT
          </span>
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
          {(Object.keys(ARM_LABEL) as Arm[]).map((a) => (
            <button
              key={a} type="button" onClick={() => setArm(a)}
              className={cn(
                'ease-fluid rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-500 active:scale-[0.98]',
                arm === a ? 'bg-fg text-ink' : 'border border-line-2 text-fg-3 hover:border-fg-3 hover:text-fg-2',
              )}
            >
              {ARM_LABEL[a]}
            </button>
          ))}
        </div>

        <div className="grid gap-6 border-b border-line p-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            {hasZones ? (
              <div className="grid grid-cols-3 gap-2">
                {GRID.flat().map((z, i) => {
                  if (!z) return <div key={i} />;
                  const zone = now.zones[z as keyof typeof now.zones];
                  const t = (zone.tempF - span.min) / (span.max - span.min || 1);
                  const mix = (a: number, b: number) => Math.round(a + (b - a) * Math.pow(t, 0.9));
                  return (
                    <div
                      key={i}
                      className="rounded-lg border border-line p-3"
                      style={{ background: `rgb(${mix(24, 92)},${mix(24, 40)},${mix(24, 20)})` }}
                    >
                      <div className="font-mono text-xs tracking-wider text-fg-3">
                        {ZONE_NAME[z]?.toUpperCase()}
                      </div>
                      <div className="tabular mt-1 font-mono text-2xl font-medium tracking-tight">
                        {zone.tempF.toFixed(1)}<span className="text-base text-fg-3"> °F</span>
                      </div>
                      <div className={cn('tabular mt-0.5 font-mono text-xs',
                        zone.co2Ppm > 1100 ? 'text-alert' : 'text-fg-3')}>
                        CO₂ {zone.co2Ppm}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-pretty text-fg-3">
                This recorded run predates per zone capture. Re run{' '}
                <span className="font-mono text-fg-2">bun sandbox.ts</span> to populate the floor plan.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <div className="font-mono text-xs tracking-wider text-fg-3">AIR HANDLING UNIT</div>
              <dl className="mt-2 space-y-1.5 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-fg-3">Zone setpoint</dt>
                  <dd className="tabular font-mono text-fg-2">
                    {now.setpointF === null ? 'building’s own' : `${now.setpointF.toFixed(1)} °F`}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-fg-3">Outside air damper</dt>
                  <dd className={cn('tabular font-mono',
                    now.outsideAirFraction !== null && now.outsideAirFraction < 0.2
                      ? 'text-alert' : 'text-fg-2')}>
                    {now.outsideAirFraction === null
                      ? 'building’s own'
                      : `${(now.outsideAirFraction * 100).toFixed(0)}%`}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="min-h-[120px]">
              <div className="font-mono text-xs tracking-wider text-fg-3">COMMANDS THIS HOUR</div>
              {now.decisions.length === 0 ? (
                <p className="mt-2 text-sm text-fg-3">None. The building is inside its bounds.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {now.decisions.map((d, i) => (
                    <li key={i} className="border-l-2 border-safe pl-3">
                      <div className="font-mono text-xs text-safe">{d.actuator.toUpperCase()}</div>
                      <p className="mt-0.5 text-xs text-pretty text-fg-3">{d.rationale}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 border-b border-line p-4">
          <button
            type="button" onClick={() => { if (hour >= hours.length - 1) setHour(0); setPlaying((p) => !p); }}
            className="ease-fluid rounded-full bg-fg px-3 py-2 text-sm font-semibold text-ink transition-all duration-500 hover:bg-fg-2 active:scale-[0.98]"
          >
            {playing ? 'Pause' : 'Play the day'}
          </button>
          <input
            type="range" min={0} max={Math.max(0, hours.length - 1)} value={hour}
            onChange={(e) => { setPlaying(false); setHour(Number(e.target.value)); }}
            aria-label="Hour of day"
            className="h-1 flex-1 accent-safe"
          />
          <span className="tabular font-mono text-sm text-fg-2">
            {new Date(now.at).toISOString().slice(11, 16)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4 border-b border-line p-4">
          <a href="/app/sandbox"
            className="ease-fluid inline-flex items-center gap-2 rounded-full bg-fg px-3 py-2 text-sm font-semibold text-ink transition-all duration-500 hover:bg-fg-2 active:scale-[0.98]">
            Next: prove it is worth it →
          </a>
        </div>

        <p className="p-4 text-xs text-pretty text-fg-3">
          Zone temperatures, CO₂, and energy are computed by BOPTEST from a US Department of Energy
          reference model. We supply setpoint and damper commands and read the result back. Point
          this at a real building and this screen does not change — the transport beneath it does.
        </p>

      </div>
    </div>
  );
}
