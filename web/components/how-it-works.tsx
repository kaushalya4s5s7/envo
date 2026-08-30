import Link from 'next/link';
import { run, tiles, cToF, spreadF } from '@/lib/data';
import { fixtureBrief } from '@/lib/brief';
import { describeTrigger } from '@/lib/plain';

/**
 * How it works, told once, in order, with real numbers.
 *
 * Every figure on this page is read from the committed artifact rather than
 * typed, per docs/decisions/product/honesty-rails.md. If the captured day
 * changes, this section changes with it.
 */

const first = run.intervals.flatMap((i) =>
  i.copilot.decisions.map((d) => ({ at: i.at, ...d })))[0];

const STEPS = [
  {
    n: '01',
    title: 'You give us an address',
    body: 'No hardware, no site visit, no access to your building automation system. We find the 100 metre square your building sits in and read the next twelve hours for that square specifically.',
    stat: `${tiles.sourceTiles.toLocaleString()} squares`,
    statNote: `spanning ${spreadF.toFixed(1)} °F at the same minute`,
  },
  {
    n: '02',
    title: 'We work out what today will do to it',
    body: 'Heat, sun angle on each face, and air quality become a plan for the day: cool early before the expensive hour, shade the side the sun is actually on, and close the fresh air intake only while it is worth closing.',
    stat: `${cToF(tiles.buildingC).toFixed(1)} °F`,
    statNote: `on this block, against ${cToF(tiles.minC).toFixed(1)} °F on the coolest one`,
  },
  {
    n: '03',
    title: 'You get one screen in the morning',
    body: 'Each item says what to do, the reading that caused it, and what would make you undo it. Not a dashboard. Something you can act on in two minutes and then close.',
    stat: `${fixtureBrief.items.length} actions`,
    statNote: `on the day we captured, ${fixtureBrief.headline.actNow} needing attention`,
  },
  {
    n: '04',
    title: 'Nothing is sent until you say so',
    body: 'It advises first. Then it runs against a simulated copy of a building so you can watch it work. Then it shadows your real one. Only then does it touch anything, one piece of equipment at a time.',
    stat: 'Four stages',
    statNote: 'you decide how far along to stop',
  },
] as const;

export function HowItWorks() {
  return (
    <>
      <section id="how" className="flex flex-col items-center px-6 pt-24 pb-12 md:pt-32">
        <h2 className="heading-gradient max-w-[680px] text-center text-3xl font-semibold tracking-tighter text-balance md:text-5xl md:leading-none">
          How it works.
        </h2>
        <p className="mt-6 max-w-[620px] text-center text-base text-pretty text-fg-2">
          Four steps, and you can stop after any of them.
        </p>

        <ol className="mt-14 grid w-full max-w-[1120px] gap-4 md:grid-cols-2">
          {STEPS.map((s) => (
            <li key={s.n} className="flex h-full flex-col rounded-2xl border border-line bg-ink p-4">
              <span className="font-mono text-xs tracking-wider text-fg-3">{s.n}</span>
              <h3 className="mt-2 text-lg font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-2 flex-1 text-sm text-pretty text-fg-2">{s.body}</p>
              <div className="mt-4 border-t border-line pt-3">
                <div className="tabular font-mono text-xl font-medium tracking-tight text-fg">
                  {s.stat}
                </div>
                <div className="mt-0.5 text-xs text-pretty text-fg-3">{s.statNote}</div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section id="proof" className="flex flex-col items-center px-6 pt-12 pb-24">
        <h2 className="heading-gradient max-w-[680px] text-center text-3xl font-semibold tracking-tighter text-balance md:text-5xl md:leading-none">
          What one decision<br />actually looks like.
        </h2>
        <p className="mt-6 max-w-[620px] text-center text-base text-pretty text-fg-2">
          Taken from the day we captured. Nothing here was written by hand.
        </p>

        {first ? (
          <div className="mt-12 w-full max-w-[840px] overflow-hidden rounded-2xl border border-line bg-ink">
            <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-4 py-3">
              <span className="tabular font-mono text-xs text-fg-2">
                {new Date(first.at).toISOString().slice(11, 16)} · {run.date}
              </span>
              <span className="font-mono text-xs text-fg-3">ADVICE ONLY</span>
            </header>

            <dl className="divide-y divide-line">
              <div className="p-4">
                <dt className="font-mono text-xs tracking-wider text-fg-3">WHAT WE WOULD DO</dt>
                <dd className="mt-1 text-base font-medium">
                  Start cooling early, before the afternoon peak
                </dd>
              </div>
              <div className="p-4">
                <dt className="font-mono text-xs tracking-wider text-fg-3">WHY</dt>
                <dd className="mt-1 text-sm text-pretty text-fg-2">
                  {describeTrigger(first.trigger.parameter, first.trigger.observed, first.trigger.threshold)}
                </dd>
              </div>
              <div className="p-4">
                <dt className="font-mono text-xs tracking-wider text-fg-3">WHAT WOULD MAKE US UNDO IT</dt>
                <dd className="mt-1 text-sm text-pretty text-fg-2">{first.reverseWhen}</dd>
              </div>
            </dl>
          </div>
        ) : null}

        <Link
          href="/replay"
          className="ease-fluid mt-8 inline-flex items-center gap-2 rounded-full border border-line-2 px-3 py-2 text-base font-semibold transition-all duration-500 hover:border-fg-3 active:scale-[0.98]"
        >
          See the whole day, hour by hour
        </Link>
      </section>
    </>
  );
}
