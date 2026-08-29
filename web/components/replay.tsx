'use client';

import { useState } from 'react';
import { clock, peakSaving, run, type Decision } from '@/lib/data';

const POLICY_LABEL: Record<string, string> = {
  air_quality: 'air quality', precool: 'pre cool', tint: 'tint', demand_response: 'demand response',
};

export function Replay() {
  const [selected, setSelected] = useState<number | null>(null);
  const peak = run.peak;
  const maxKwh = Math.max(...run.intervals.map((i) => Math.max(i.copilot.coolingKwh, i.baseline.coolingKwh)));

  const decisions = selected === null ? [] : [
    ...run.intervals[selected]!.copilot.decisions.map((d) => ({ ...d, side: 'Envo' })),
    ...run.intervals[selected]!.baseline.decisions.map((d) => ({ ...d, side: 'Citywide baseline' })),
  ];

  return (
    <div className="w-full max-w-[1120px] rounded-2xl border border-line bg-surface p-2">
      <div className="overflow-hidden rounded-lg border border-line bg-ink">

        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-4 py-3">
          <span className="font-mono text-xs text-fg-3">
            {run.fixtureId} · <b className="font-medium text-fg-2">{run.building.segmentId}</b>
          </span>
          <span className="font-mono text-xs text-fg-3">
            {run.synthetic
              ? <b className="text-alert">SYNTHETIC FIXTURE</b>
              : <b className="text-safe">CAPTURED, NOT SYNTHETIC</b>}
          </span>
        </header>

        {/* Timeline. Click any hour to read what the agent decided and why. */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left font-mono text-xs text-fg-3">
                <th className="p-3 font-medium">HOUR</th>
                <th className="p-3 font-medium">APPARENT</th>
                <th className="p-3 font-medium">OZONE AQI</th>
                <th className="p-3 font-medium text-fg">ENVELOPE COPILOT</th>
                <th className="p-3 font-medium">ZONE</th>
                <th className="p-3 font-medium">INTAKE</th>
                <th className="p-3 font-medium">CITYWIDE BASELINE</th>
                <th className="p-3 font-medium">ZONE</th>
                <th className="p-3 font-medium">kWh SPLIT</th>
              </tr>
            </thead>
            <tbody className="tabular font-mono text-xs">
              {run.intervals.map((row, i) => {
                const inPeak = i >= peak.from && i <= peak.to;
                const sealed = row.copilot.outsideAirFraction === 0;
                return (
                  <tr
                    key={row.at}
                    onClick={() => setSelected(selected === i ? null : i)}
                    className={`ease-fluid cursor-pointer border-b border-line transition-colors duration-300 hover:bg-surface-2 ${
                      selected === i ? 'bg-surface-3' : inPeak ? 'bg-surface' : ''}`}
                  >
                    <td className="p-3 text-fg-2">{clock(row.at)}</td>
                    <td className="p-3">{row.env.apparentTempF.toFixed(0)}°F</td>
                    <td className={`p-3 ${row.env.ozoneAqi >= 151 ? 'text-alert' : 'text-fg-3'}`}>
                      {row.env.ozoneAqi}
                    </td>
                    <td className="p-3 text-safe">
                      {row.copilot.decisions.map((d) => POLICY_LABEL[d.policy] ?? d.policy).join(' + ') || '·'}
                    </td>
                    <td className="p-3">{row.copilot.zoneTempF.toFixed(1)}</td>
                    <td className={`p-3 ${sealed ? 'text-safe' : 'text-fg-3'}`}>{sealed ? 'CLOSED' : 'open'}</td>
                    <td className="p-3 text-fg-3">
                      {row.baseline.decisions.map((d) => POLICY_LABEL[d.policy] ?? d.policy).join(' + ') || '·'}
                    </td>
                    <td className="p-3 text-fg-3">{row.baseline.zoneTempF.toFixed(1)}</td>
                    <td className="p-3">
                      <span className="flex h-3 w-24 gap-px" aria-hidden="true">
                        <span className="bg-safe" style={{ width: `${(row.copilot.coolingKwh / maxKwh) * 50}%` }} />
                        <span className="bg-alert/70" style={{ width: `${(row.baseline.coolingKwh / maxKwh) * 50}%` }} />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Rationale. Every command carries one, and this is where it is read. */}
        <div className="border-t border-line p-4">
          {selected === null ? (
            <p className="text-sm text-fg-3">
              Select any hour to read the decision record behind it. Every command the agent issues
              carries its own rationale, the parameter that triggered it, and the condition that reverses it.
            </p>
          ) : decisions.length === 0 ? (
            <p className="text-sm text-fg-3">
              <b className="font-medium text-fg-2">{clock(run.intervals[selected]!.at)}</b> — neither
              strategy changed anything this hour. Holding a setpoint is a decision too, and it costs
              nothing to log.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {decisions.map((d, k) => <Record key={k} decision={d} />)}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 border-t border-line md:grid-cols-4">
          <Metric label="PEAK WINDOW ENERGY" value={`${peakSaving.toFixed(1)}%`} note="less than the baseline"
            tone="text-safe" />
          <Metric label="WHOLE DAY" value={`${run.metrics.dayKwh.copilot} kWh`}
            note={`baseline ${run.metrics.dayKwh.baseline} kWh`} />
          <Metric label="HOURS ON REDUCED INTAKE" value={String(run.metrics.reducedIntakeHours.copilot)}
            note={`baseline ${run.metrics.reducedIntakeHours.baseline}, during a real ozone event`} />
          <Metric label="PEAK ZONE TEMP" value={`${run.metrics.maxZoneF.copilot} °F`}
            note={`baseline ${run.metrics.maxZoneF.baseline} °F, ceiling 78`} />
        </div>

        <p className="border-t border-line p-4 text-xs text-pretty text-fg-3">
          Environmental data captured from FortyGuard on {run.capturedAt?.slice(0, 10)} for {run.date}, at{' '}
          {run.building.lat}, {run.building.lon}. Energy, zone temperature, and indoor air are{' '}
          <b className="font-medium text-fg-2">modeled by a digital twin, not metered</b>. The building
          is simulated; the weather is not. Both strategies run the identical loop over the identical
          day, and only the signal each one sees differs.
        </p>
      </div>
    </div>
  );
}

function Record({ decision }: { decision: Decision & { side: string } }) {
  return (
    <article className="rounded-lg border border-line bg-surface-2 p-3">
      <header className="flex flex-wrap items-center gap-2 font-mono text-xs">
        <span className={decision.side === 'Envo' ? 'text-safe' : 'text-fg-3'}>{decision.side}</span>
        <span className="text-fg-3">·</span>
        <span className="text-fg-2">{POLICY_LABEL[decision.policy] ?? decision.policy}</span>
        <span className="text-fg-3">→ {decision.actuator}</span>
      </header>
      <p className="mt-2 text-sm text-pretty text-fg-2">{decision.rationale}</p>
      <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs text-fg-3">
        <div>
          <dt className="inline">trigger </dt>
          <dd className="inline text-fg-2">
            {decision.trigger.parameter} {decision.trigger.observed.toFixed(1)} vs {decision.trigger.threshold}
          </dd>
        </div>
        <div><dt className="inline">reverses when </dt><dd className="inline text-fg-2">{decision.reverseWhen}</dd></div>
      </dl>
    </article>
  );
}

function Metric({ label, value, note, tone = 'text-fg' }: {
  label: string; value: string; note: string; tone?: string;
}) {
  return (
    <div className="border-t border-line p-4 not-last:border-r md:border-t-0">
      <div className="font-mono text-xs tracking-wider text-fg-3">{label}</div>
      <div className={`tabular mt-1 font-mono text-xl font-medium tracking-tight ${tone}`}>{value}</div>
      <div className="mt-0.5 text-xs text-pretty text-fg-3">{note}</div>
    </div>
  );
}
