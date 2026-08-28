import type { Artifact } from 'core/copilot/artifact';
import { buildBrief, fixtureBrief } from '@/lib/brief';
import { run } from '@/lib/data';
import { cn } from '@/lib/cn';

/**
 * The 07:15 screen.
 *
 * The design test from who-we-build-for.md: would this change what an operator
 * DOES, not just what they know? Every row is an action with the reading that
 * caused it and the condition that reverses it. No charts.
 *
 * Takes a day rather than reading the fixture, so a live capture for the user's
 * own address and the committed demo day render through the identical path.
 */
export function MorningBrief({
  day, timezone, agent,
}: {
  day?: Artifact | typeof run;
  timezone?: string;
  /** Absent on a live capture: the agent narrative is produced at build time. */
  agent?: { model: string; summary: string };
} = {}) {
  const source = day ?? run;
  const { items, headline } = day ? buildBrief(day, timezone) : fixtureBrief;
  return (
    <div className="w-full max-w-[1120px] rounded-2xl border border-line bg-surface p-2">
      <div className="overflow-hidden rounded-lg border border-line bg-ink">

        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-4 py-3">
          <span className="font-mono text-xs text-fg-3">
            {source.building.name.toUpperCase()} · {source.date} · <b className="font-medium text-fg-2">
            {source.building.segmentId}</b>
          </span>
          <span className="font-mono text-xs text-fg-3">
            ADVICE ONLY — WE SUGGEST, YOUR TEAM DECIDES
          </span>
        </header>

        {/* The one sentence that justifies opening the app. */}
        <div className="border-b border-line p-4">
          <p className="max-w-[720px] text-base text-pretty text-fg md:text-lg">
            Today peaks at <b className="text-heat">{headline.peakF.toFixed(0)} °F</b> around{' '}
            <b>{headline.peakAt}</b>, and air quality turns at <b>{headline.worstAt}</b> with an index
            of <b className={headline.worstAqi >= 151 ? 'text-alert' : 'text-smoke'}>
            {headline.worstAqi.toFixed(0)}</b>.{' '}
            {headline.actNow > 0
              ? <>There {headline.actNow === 1 ? 'is' : 'are'} <b className="text-alert">{headline.actNow}</b>{' '}
                thing{headline.actNow === 1 ? '' : 's'} to act on.</>
              : <>Nothing needs you before the peak.</>}
          </p>
        </div>

        <div className="border-b border-line">
          {items.map((item, i) => (
            <div key={`${item.at}-${i}`} className="flex flex-wrap items-start gap-4 border-t border-line px-4 py-3 first:border-t-0">
              <span className="tabular w-12 flex-none font-mono text-sm text-fg-2">{item.at}</span>
              <span className={cn(
                'w-16 flex-none font-mono text-xs font-medium tracking-wide',
                item.severity === 'act' ? 'text-alert' : 'text-fg-3',
              )}>
                {item.severity === 'act' ? 'ACT' : 'PLAN'}
              </span>
              <div className="min-w-[240px] flex-1">
                <div className="text-sm font-medium">{item.headline}</div>
                <div className="mt-0.5 font-mono text-xs text-fg-3">{item.because}</div>
                <div className="mt-1 text-xs text-pretty text-fg-3">
                  <span className="text-fg-2">Reverses when </span>{item.reverses}
                </div>
              </div>
              <button type="button"
                className="ease-fluid rounded-full border border-line-2 px-3 py-2 text-sm font-semibold transition-all duration-500 hover:border-fg-3 active:scale-[0.98]">
                Acknowledge
              </button>
            </div>
          ))}
        </div>

        {agent ? (
          <div className="border-b border-line p-4">
            <div className="font-mono text-xs tracking-wider text-fg-3">
              WHY, IN FULL · {agent.model}
            </div>
            <p className="mt-2 max-w-[760px] text-sm text-pretty text-fg-2">{agent.summary}</p>
          </div>
        ) : null}

        <p className="p-4 text-xs text-pretty text-fg-3">
          Outdoor readings are real, captured for this building&rsquo;s own block. Indoor
          temperature, energy and cost are <b className="font-medium text-fg-2">estimated by a
          model, not measured by a meter</b>, because this building is not connected to us. Nothing
          here has been sent to any equipment.
        </p>

      </div>
    </div>
  );
}
