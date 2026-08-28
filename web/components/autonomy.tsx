'use client';

import { useMemo, useState } from 'react';
import type { Actuator } from 'core/contracts';
import { DEFAULT_GRANTS, LEVELS, gate, type GrantMap } from 'core/autonomy';
import { run } from '@/lib/data';
import { EQUIPMENT, PERMISSION, POLICY } from '@/lib/plain';
import { cn } from '@/lib/cn';

/**
 * Phase 4 — Autonomy, granted per actuator.
 *
 * The grants are applied to the real captured day, so moving a control shows
 * exactly which of that day's commands would have reached the building and
 * which would have been withheld, with the reason. An abstract toggle teaches
 * nobody anything about what they are agreeing to.
 */

export function Autonomy() {
  const [grants, setGrants] = useState<GrantMap>(DEFAULT_GRANTS);

  // Every decision the agent took on the captured day, run through the gate.
  const result = useMemo(() => {
    const commands = run.intervals.flatMap((i) =>
      i.copilot.decisions.map((d) => ({
        actuator: d.actuator as Actuator, at: i.at, rationale: d.rationale, policy: d.policy,
      })),
    );
    const { allowed, withheld } = gate(commands as never, grants);
    return { total: commands.length, allowed: allowed as never as typeof commands, withheld };
  }, [grants]);

  return (
    <div className="w-full max-w-[1120px] rounded-2xl border border-line bg-surface p-2">
      <div className="overflow-hidden rounded-lg border border-line bg-ink">

        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-4 py-3">
          <span className="font-mono text-xs text-fg-3">
            TRIED AGAINST A REAL DAY · {result.total} DECISIONS
          </span>
          <span className={cn('font-mono text-xs',
            result.allowed.length > 0 ? 'text-safe' : 'text-fg-3')}>
            {result.allowed.length === 0
              ? 'NOTHING WOULD BE SENT'
              : `${result.allowed.length} OF ${result.total} WOULD BE SENT`}
          </span>
        </header>

        <div className="border-b border-line p-4">
          <p className="max-w-[760px] text-base text-pretty text-fg md:text-lg">
            For each piece of equipment, you decide how far we may go.{' '}
            <b>Everything starts off.</b> Nobody hands over a whole building with one switch.
          </p>
        </div>

        <div className="border-b border-line">
          {(Object.keys(EQUIPMENT) as Actuator[]).map((a) => (
            <div key={a} className="border-t border-line px-4 py-3 first:border-t-0">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-[240px] flex-1">
                  <div className="text-sm font-medium">{EQUIPMENT[a]?.label}</div>
                  <p className="mt-0.5 max-w-[420px] text-xs text-pretty text-fg-3">{EQUIPMENT[a]?.risk}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-1">
                    {LEVELS.map((l) => (
                      <button
                        key={l} type="button"
                        onClick={() => setGrants((g) => ({ ...g, [a]: l }))}
                        className={cn(
                          'ease-fluid rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-500 active:scale-[0.98]',
                          grants[a] === l
                            ? l === 'autonomous' ? 'bg-safe text-ink' : 'bg-fg text-ink'
                            : 'border border-line-2 text-fg-3 hover:border-fg-3 hover:text-fg-2',
                        )}
                      >
                        {PERMISSION[l]?.label}
                      </button>
                    ))}
                  </div>
                  {/* Only the chosen setting is explained, so the page is not four
                      copies of the same sentence. */}
                  <p className="max-w-[420px] text-xs text-pretty text-fg-3">
                    {PERMISSION[grants[a]]?.means}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="border-b border-line p-4">
          <div className="font-mono text-xs tracking-wider text-fg-3">
            ON A REAL DAY, {run.date}
          </div>
          {result.allowed.length === 0 ? (
            <p className="mt-2 max-w-[720px] text-sm text-pretty text-fg-2">
              <b>Nothing would be sent.</b> We would still work out all {result.total} decisions,
              explain each one and write them down. You would just do them yourself. Most buildings
              should stay like this for weeks.
            </p>
          ) : (
            <ul className="mt-2 space-y-1">
              {result.allowed.map((c, i) => (
                <li key={`${c.at}-${i}`} className="flex flex-wrap items-baseline gap-3 text-sm">
                  <span className="tabular font-mono text-xs text-safe">SEND</span>
                  <span className="tabular font-mono text-xs text-fg-3">
                    {new Date(c.at).toISOString().slice(11, 16)}
                  </span>
                  <span className="flex-1 text-fg-2">
                    {EQUIPMENT[c.actuator]?.label}
                    <span className="text-fg-3"> — {POLICY[c.policy] ?? c.policy}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-b border-line p-4">
          <div className="font-mono text-xs tracking-wider text-fg-3">WHAT HAPPENS AFTER THIS</div>
          {result.allowed.length === 0 ? (
            <p className="mt-2 max-w-[720px] text-sm text-pretty text-fg-2">
              Nothing changes yet, which is the right place to start. You keep getting one screen
              each morning telling you what today will do to the building, and you act on it
              yourself. Come back and allow something whenever you are ready.
            </p>
          ) : (
            <p className="mt-2 max-w-[720px] text-sm text-pretty text-fg-2">
              That is the setup finished. From here it is the same thing every day: we read your
              block overnight, work out the plan, send only what you allowed, and write down every
              decision so you can check it or reverse it. You look at one screen in the morning.
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <a href="/app"
              className="ease-fluid inline-flex items-center gap-2 rounded-full bg-fg px-3 py-2 text-sm font-semibold text-ink transition-all duration-500 hover:bg-fg-2 active:scale-[0.98]">
              See your morning screen →
            </a>
            <a href="/app/decisions"
              className="text-sm font-medium text-fg-2 underline underline-offset-4">
              Or read the full decision log
            </a>
          </div>
        </div>

        <p className="p-4 text-xs text-pretty text-fg-3">
          These settings are the last thing an instruction passes before it would leave for a
          building, and they only know what you allowed. Nothing here is connected to real equipment.
        </p>

      </div>
    </div>
  );
}
