import type { Metadata } from 'next';
import { Reveal } from '@/components/reveal';
import { run } from '@/lib/data';
import { describeTrigger, plain } from '@/lib/plain';

export const metadata: Metadata = {
  title: 'Decisions — Envo',
  description: 'Every decision, its trigger, its rationale, and the condition that reverses it.',
};

/**
 * The audit log.
 *
 * who-we-build-for.md: the reader may be a third party contractor managing
 * buildings for someone else, who has to justify a decision to a client that was
 * not in the room. So every row carries the reading that caused it and the
 * condition that undoes it — not a score, and not a chart.
 */
/** What each instruction actually does, in the words an operator would use. */
const ACTION: Record<string, string> = {
  hvac_setpoint: 'Change the target temperature',
  outside_air_damper: 'Change how much outside air comes in',
  facade_tint: 'Darken the windows on one side',
  demand_response: 'Shift power use away from the expensive hour',
};

export default function DecisionsPage() {
  const rows = run.intervals.flatMap((i) =>
    i.copilot.decisions.map((d) => ({ at: i.at, ...d })));

  return (
    <main id="main" className="flex flex-col items-center px-6 pb-20 pt-24 md:pt-16 md:pl-72">
      <Reveal delay={120}>
          <h1 className="heading-gradient max-w-[760px] text-center text-4xl font-semibold tracking-tighter text-balance md:text-6xl md:leading-none">
            Every decision,<br />and why.
          </h1>
        </Reveal>
        <Reveal delay={230}>
          <p className="mt-6 max-w-[680px] text-center text-base text-pretty text-fg-2 md:text-lg">
            You may have to explain one of these to somebody who was not in the room. Each entry
            says what we would do, the reading that set it off, and what would make us undo it.
          </p>
        </Reveal>

        <Reveal delay={340} className="mt-16 flex w-full justify-center">
          <div className="w-full max-w-[1120px] rounded-2xl border border-line bg-surface p-2">
            <div className="overflow-hidden rounded-lg border border-line bg-ink">
              <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-4 py-3">
                <span className="font-mono text-xs text-fg-3">
                  {run.building.name.toUpperCase()} · {run.date} · {rows.length} DECISIONS
                </span>
                <span className="font-mono text-xs text-fg-3">ADVISORY — NOTHING WAS SENT</span>
              </header>

              {rows.map((d, i) => (
                <article key={`${d.at}-${i}`} className="border-t border-line p-4 first:border-t-0">
                  <div className="flex flex-wrap items-baseline gap-3">
                    <span className="tabular font-mono text-sm text-fg-2">
                      {new Date(d.at).toISOString().slice(11, 16)}
                    </span>
                    <span className="text-sm font-medium">
                      {ACTION[d.actuator] ?? d.actuator}
                    </span>
                    <span className="font-mono text-xs tracking-wider text-fg-3">
                      {d.policy.replace(/_/g, ' ')}
                    </span>
                    {d.conflictsOverridden?.length ? (
                      <span className="font-mono text-xs text-alert">
                        OVERRODE {d.conflictsOverridden.length}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 max-w-[860px] text-sm text-pretty text-fg">{d.rationale}</p>
                  <dl className="mt-2 flex flex-wrap gap-x-8 gap-y-1 text-xs">
                    <div className="flex gap-2">
                      <dt className="text-fg-3">What set it off</dt>
                      <dd className="text-fg-2">
                        {describeTrigger(d.trigger.parameter, d.trigger.observed, d.trigger.threshold)}
                        <span className="ml-2 font-mono text-xs text-fg-3/60">
                          {d.trigger.parameter}
                        </span>
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-fg-3">Reverses when</dt>
                      <dd className="text-fg-2">{d.reverseWhen}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </div>
      </Reveal>
    </main>
  );
}
