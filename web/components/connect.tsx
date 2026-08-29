'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { CapabilityId, CapabilityMatch, DiscoveredPoint } from 'core/connect';
import { readiness } from 'core/connect';
import { cn } from '@/lib/cn';

/**
 * Phase 3 — Connect. Point discovery and mapping.
 *
 * This is the step the whole industry loses time to: a building exposes hundreds
 * of points named `hvac_oveAhu_yOA_u` and a person has to decide which is the
 * outside air damper. It is 30 to 40% of BMS integration labour.
 *
 * What runs here is real: the points come from a genuine discovery against a
 * BOPTEST building, the suggestions are ranked and explained, and nothing is
 * applied without a person confirming.
 *
 * What is **not** real is the transport. BOPTEST speaks HTTP. A building speaks
 * BACnet or Modbus on a network that is usually not internet routable, and
 * `BmsAdapter.apply` is synchronous, so it cannot hold a real BMS without
 * becoming async first. Pointing this at a building is a protocol and network
 * project, not a credential. Said plainly on the page rather than glossed.
 */

interface Discovery {
  source: 'live' | 'committed';
  testcase: string;
  discoveredAt: string;
  points: DiscoveredPoint[];
  mappings: CapabilityMatch[];
}

export function Connect() {
  const [data, setData] = useState<Discovery | null>(null);
  const [chosen, setChosen] = useState<Partial<Record<CapabilityId, string>>>({});
  const [confirmed, setConfirmed] = useState<Set<CapabilityId>>(new Set());
  const [busy, setBusy] = useState(false);
  /** Which row has its alternatives open. Only one at a time, to keep it quiet. */
  const [picking, setPicking] = useState<CapabilityId | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async (live: boolean) => {
    setBusy(true); setError('');
    try {
      const r = await fetch(`/api/points${live ? '?live=1' : ''}`);
      const body = await r.json();
      if (!r.ok) { setError(body.error ?? 'Discovery failed.'); return; }
      setData(body);
      // Preselect the top candidate but confirm nothing — a mapping accepted
      // silently is how a command reaches the wrong actuator.
      const pre: Partial<Record<CapabilityId, string>> = {};
      for (const m of body.mappings as CapabilityMatch[]) {
        if (m.candidates[0]) pre[m.capability] = m.candidates[0].point.name;
      }
      setChosen(pre); setConfirmed(new Set());
    } finally { setBusy(false); }
  }, []);

  useEffect(() => { void load(false); }, [load]);

  const needed = data?.mappings.filter((m) => m.candidates.length > 0).length ?? 0;
  const confirmedCount = confirmed.size;

  const state = useMemo(() => {
    const accepted: Partial<Record<CapabilityId, string>> = {};
    for (const c of confirmed) if (chosen[c]) accepted[c] = chosen[c];
    return readiness(accepted);
  }, [chosen, confirmed]);

  const toggle = (id: CapabilityId) => setConfirmed((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div className="w-full max-w-[1120px] rounded-2xl border border-line bg-surface p-2">
      <div className="overflow-hidden rounded-lg border border-line bg-ink">

        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-4 py-3">
          <span className="font-mono text-xs text-fg-3">
            {data ? <>{data.points.length} POINTS · <b className="font-medium text-fg-2">{data.testcase}</b></> : 'DISCOVERING…'}
          </span>
          <span className={cn('font-mono text-xs', data?.source === 'live' ? 'text-safe' : 'text-fg-3')}>
            {data?.source === 'live' ? 'LIVE DISCOVERY' : 'COMMITTED DISCOVERY'}
          </span>
        </header>

        <div className="border-b border-line p-4">
          <p className="max-w-[720px] text-base text-pretty text-fg md:text-lg">
            This building has {data ? data.points.length : 95} sensors and switches with names like{' '}
            <code className="font-mono text-sm text-fg-2">hvac_oveAhu_yOA_u</code>.{' '}
            <b>We need four of them.</b> Check each match below.
          </p>
        </div>

        <div className="border-b border-line">
          {data?.mappings.map((m) => {
            const isConfirmed = confirmed.has(m.capability);
            const none = m.candidates.length === 0;
            const pick = m.candidates.find((c) => c.point.name === chosen[m.capability]);
            const open = picking === m.capability;

            return (
              <div key={m.capability} className={cn(
                'border-t border-line px-4 py-3 first:border-t-0',
                none ? 'opacity-60' : null,
              )}>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="min-w-[220px] flex-1">
                    <div className="flex items-center gap-2">
                      {isConfirmed ? <span className="text-safe">✓</span> : null}
                      <span className="text-sm font-medium">{m.label}</span>
                    </div>
                    <p className="mt-0.5 max-w-[380px] text-xs text-pretty text-fg-3">{m.enables}</p>
                  </div>

                  {none ? (
                    <span className="text-xs text-fg-3">Not in this building. That is normal.</span>
                  ) : (
                    <>
                      <div className="min-w-[220px] flex-1">
                        {/* The building's own description. The evidence, in its words. */}
                        <p className="text-xs text-pretty text-fg-2">&ldquo;{pick?.because}&rdquo;</p>
                        <button
                          type="button"
                          onClick={() => setPicking(open ? null : m.capability)}
                          className="ease-fluid mt-0.5 font-mono text-xs text-fg-3 underline underline-offset-2 transition-colors duration-300 hover:text-fg-2"
                        >
                          {open ? 'close' : `not this one? ${m.candidates.length - 1} others`}
                        </button>
                      </div>

                      <button
                        type="button" onClick={() => toggle(m.capability)}
                        className={cn(
                          'ease-fluid flex-none rounded-full px-3 py-2 text-sm font-semibold transition-all duration-500 active:scale-[0.98]',
                          isConfirmed ? 'bg-safe text-ink' : 'bg-fg text-ink hover:bg-fg-2',
                        )}
                      >
                        {isConfirmed ? 'Confirmed' : 'Confirm'}
                      </button>
                    </>
                  )}
                </div>

                {open ? (
                  <ul className="mt-3 overflow-hidden rounded-lg border border-line">
                    {m.candidates.map((c) => (
                      <li key={c.point.name}>
                        <button
                          type="button"
                          onClick={() => {
                            setChosen((x) => ({ ...x, [m.capability]: c.point.name }));
                            setConfirmed((prev) => { const n = new Set(prev); n.delete(m.capability); return n; });
                            setPicking(null);
                          }}
                          className={cn(
                            'ease-fluid block w-full border-b border-line px-3 py-2 text-left transition-colors duration-300 last:border-b-0 hover:bg-surface-2',
                            c.point.name === chosen[m.capability] ? 'bg-surface-2' : null,
                          )}
                        >
                          <span className="block text-xs text-fg-2">{c.point.description}</span>
                          <span className="block font-mono text-xs text-fg-3">{c.point.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* One progress line, not a grid of statuses that all read as failure. */}
        <div className="border-b border-line p-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="tabular font-mono text-sm text-fg-2">
              {confirmedCount} of {needed} confirmed
            </span>
            <div className="h-1 min-w-[120px] flex-1 overflow-hidden rounded-full bg-line">
              <div className="ease-fluid h-full rounded-full bg-safe transition-all duration-700"
                style={{ width: `${needed === 0 ? 0 : (confirmedCount / needed) * 100}%` }} />
            </div>
          </div>
          <p className="mt-2 max-w-[720px] text-sm text-pretty text-fg-2">
            {state.canActuate
              ? 'That is everything we need. The agent could drive this building now, and still will not until you grant it, one control at a time.'
              : 'Confirm the two marked required and the agent can start work. The other two make it better at its job.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 border-b border-line p-4">
          <button
            type="button" onClick={() => void load(true)} disabled={busy}
            className="ease-fluid rounded-full bg-fg px-3 py-2 text-sm font-semibold text-ink transition-all duration-500 hover:bg-fg-2 active:scale-[0.98] disabled:opacity-30"
          >
            {busy ? 'Discovering…' : 'Re discover from the live building'}
          </button>
          {error ? <span className="text-sm text-alert">{error}</span> : null}
          <Link href="/app/building" className="text-sm font-medium text-fg-2 underline underline-offset-4">
            Next: watch it run →
          </Link>
        </div>

        <p className="p-4 text-xs text-pretty text-fg-3">
          These points are a real discovery against a BOPTEST building, which speaks HTTP. Your
          building speaks BACnet or Modbus on a network that is probably not reachable from here.
          Mapping is solved above; <b className="font-medium text-fg-2">the transport is not
          built</b>, and that is the honest remaining gap.
        </p>

      </div>
    </div>
  );
}
