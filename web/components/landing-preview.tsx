import Link from 'next/link';
import { cToF, peakSaving, run, spreadF, tiles } from '@/lib/data';
import { fixtureBrief } from '@/lib/brief';
import { describeTrigger } from '@/lib/plain';
import { BuildingRig } from './building-rig';
import { HeatGrid } from './heat-grid';
import { BlurIn, BlurLines } from './blur-in';
import { PreviewNav } from './preview-nav';
import { Parallax } from './preview-motion';
import { Reveal } from './reveal';

const first = run.intervals.flatMap((interval) =>
  interval.copilot.decisions.map((decision) => ({ at: interval.at, ...decision })),
)[0];

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

const STAGES = [
  ['01', 'Advisory', 'See the plan before anything is sent.'],
  ['02', 'Sandbox', 'Watch the same commands move a simulated building.'],
  ['03', 'Shadow', 'Compare the recommendation with a real building.'],
  ['04', 'Autonomy', 'Grant permission one actuator at a time.'],
] as const;

export function LandingPreview() {
  return (
    <div className="landing-preview relative min-h-screen">
      <PreviewNav />

      <main id="main">
        <section className="landing-preview-hero relative overflow-hidden px-5 pb-16 pt-40 md:px-12 md:pt-48">
          <Parallax strength={0.12} className="pointer-events-none absolute inset-x-0 bottom-0">
            <div className="sun-disc" aria-hidden="true" />
          </Parallax>

          <div className="relative mx-auto flex max-w-[1344px] flex-col items-center">
            <BlurIn delay={80}>
              <span className="mb-8 inline-flex items-center gap-2 border border-line px-3 py-1 font-mono text-xs tracking-[0.05em] text-fg-2">
                <span className="grid flex-none grid-cols-2 grid-rows-2 gap-px" aria-hidden="true">
                  <i className="block size-[3px] bg-line" />
                  <i className="block size-[3px] bg-heat" />
                  <i className="block size-[3px] bg-smoke" />
                  <i className="block size-[3px] bg-fg-3" />
                </span>
                Decision layer for building automation
              </span>
            </BlurIn>

            <BlurLines
              delay={180}
              className="display max-w-[680px] text-center text-5xl leading-none text-balance text-fg md:text-7xl"
              lines={['Your building knows', 'the weather.', 'Not your block.']}
            />

            <BlurIn delay={520}>
              <p className="mt-8 mb-8 max-w-[560px] text-center text-base leading-[1.625] text-pretty text-fg-2">
                The next twelve hours of block level heat and sun, combined with ozone and particulate
                air quality, become coordinated setpoint, shade, and outside air decisions that balance
                comfort, energy, and indoor CO₂.
              </p>
            </BlurIn>

            <BlurIn delay={680}>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-sm bg-[#DDD8D5] px-3 py-2 text-base font-medium text-[#0B0907] transition-colors duration-300 ease-out hover:bg-fg"
              >
                Get started
                <svg width="16" height="16" viewBox="0 0 256 256" fill="none" aria-hidden="true">
                  <path d="M40 128h176M152 64l64 64-64 64" stroke="currentColor" strokeWidth="20"
                    strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </BlurIn>

            <Reveal delay={400} className="mt-16 w-full">
              <Parallax strength={0.06}>
                <LiveOps />
              </Parallax>
            </Reveal>
          </div>
        </section>

        <div className="wash-hero-end relative" aria-hidden="true">
          <Parallax strength={0.2} className="absolute inset-0 flex items-center justify-center">
            <HorizonMark />
          </Parallax>
        </div>

        <section id="problem" className="band-dust px-5 py-20 md:px-12 md:py-24">
          <div className="mx-auto grid max-w-[1344px] items-center gap-16 md:grid-cols-[1fr_1fr] md:gap-24">
            <Reveal>
              <p className="font-mono text-xs tracking-[0.05em] text-fg-3">THE MISSING SIGNAL</p>
              <h2 className="display mt-6 max-w-[640px] text-4xl leading-tight text-balance md:text-6xl">
                Heat, smoke, sun, and CO₂ arrive as one operating decision.
              </h2>
              <p className="mt-8 max-w-[520px] text-lg leading-[1.625] text-pretty text-fg-2">
                A building can react to what is happening inside. It cannot prepare for what is
                about to happen outside without a usable forecast. Envo keeps those signals honest,
                then gives the operator one explainable plan.
              </p>
            </Reveal>
            <Reveal delay={80}>
              <OrbitField />
            </Reveal>
          </div>
        </section>

        <div className="wash-to-night" aria-hidden="true" />

        <section id="how" className="band-night px-5 py-20 md:px-12 md:py-24">
          <div className="mx-auto max-w-[1344px]">
            <Reveal>
              <p className="font-mono text-xs tracking-[0.05em] text-fg-3">HOW IT WORKS</p>
              <h2 className="display mt-6 max-w-[680px] text-4xl leading-tight text-balance md:text-6xl">
                Four steps, and you can stop after any of them.
              </h2>
            </Reveal>
            <Reveal delay={80} className="mt-16">
              <ol className="grid border-y border-line md:grid-cols-2">
                {STEPS.map((step) => (
                  <li key={step.n} className="border-b border-line px-5 py-8 last:border-b-0 md:border-r md:odd:border-r md:even:border-r-0">
                    <span className="font-mono text-xs tracking-[0.05em] text-fg-3">{step.n}</span>
                    <h3 className="mt-8 text-xl font-normal tracking-tight">{step.title}</h3>
                    <p className="mt-3 max-w-[480px] text-sm leading-6 text-pretty text-fg-2">{step.body}</p>
                    <div className="mt-8 border-t border-line pt-4">
                      <div className="tabular font-mono text-xl text-fg">{step.stat}</div>
                      <div className="mt-1 text-xs text-fg-3">{step.statNote}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </Reveal>
          </div>
        </section>

        <div className="wash-to-dust" aria-hidden="true" />

        <section id="proof" className="band-dust px-5 py-20 md:px-12 md:py-24">
          <div className="mx-auto grid max-w-[1344px] gap-12 md:grid-cols-[0.75fr_1.25fr] md:gap-24">
            <Reveal>
              <p className="font-mono text-xs tracking-[0.05em] text-fg-3">ONE DECISION</p>
              <h2 className="display mt-6 max-w-[440px] text-4xl leading-tight text-balance md:text-5xl">
                What one decision actually looks like.
              </h2>
              <p className="mt-6 max-w-[380px] text-base leading-6 text-pretty text-fg-2">
                Taken from the day we captured. Nothing here was written by hand.
              </p>
            </Reveal>

            {first ? (
              <Reveal delay={80}>
                <article className="rounded-sm border border-line bg-[#FFF6E5]/40">
                  <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-4">
                    <span className="tabular font-mono text-xs text-fg-2">
                      {new Date(first.at).toISOString().slice(11, 16)} · {run.date}
                    </span>
                    <span className="inline-flex items-center gap-2 font-mono text-xs tracking-[0.05em] text-fg-3">
                      <i className="live-dot size-1.5 rounded-full bg-[#FF8B3E]" aria-hidden="true" />
                      ADVICE ONLY
                    </span>
                  </header>
                  <dl className="divide-y divide-line">
                    <ProofRow label="WHAT WE WOULD DO" value="Start cooling early, before the afternoon peak" />
                    <ProofRow
                      label="WHY"
                      value={describeTrigger(first.trigger.parameter, first.trigger.observed, first.trigger.threshold)}
                    />
                    <ProofRow label="WHAT WOULD MAKE US UNDO IT" value={first.reverseWhen} />
                  </dl>
                </article>
              </Reveal>
            ) : null}
          </div>
        </section>

        <div className="wash-to-night" aria-hidden="true" />

        <section id="trust" className="band-night px-5 py-20 md:px-12 md:py-24">
          <div className="mx-auto max-w-[1344px]">
            <Reveal>
              <p className="font-mono text-xs tracking-[0.05em] text-fg-3">A CONTROLLED PATH TO TRUST</p>
              <h2 className="display mt-6 max-w-[760px] text-4xl leading-tight text-balance md:text-6xl">
                Start with advice. Earn the right to act.
              </h2>
            </Reveal>
            <Reveal delay={80} className="mt-16">
              <ol className="relative grid border-y border-line md:grid-cols-4">
                <span className="pointer-events-none absolute top-8 right-5 left-5 hidden h-px bg-line-2 md:block" aria-hidden="true" />
                {STAGES.map(([number, title, body]) => (
                  <li key={number} className="relative border-b border-line px-5 py-8 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
                    <span className="relative z-10 inline-block bg-ink pr-2 font-mono text-xs tracking-[0.05em] text-fg-3">{number}</span>
                    <h3 className="mt-10 text-xl font-normal tracking-tight">{title}</h3>
                    <p className="mt-3 text-sm leading-6 text-pretty text-fg-2">{body}</p>
                  </li>
                ))}
              </ol>
            </Reveal>
          </div>
        </section>

        <div className="wash-to-dust" aria-hidden="true" />

        <section id="evidence" className="band-dust px-5 py-20 md:px-12 md:py-24">
          <div className="mx-auto grid max-w-[1344px] gap-12 md:grid-cols-[0.8fr_1.2fr] md:gap-24">
            <Reveal>
              <p className="font-mono text-xs tracking-[0.05em] text-fg-3">THE CAPTURED DAY</p>
              <h2 className="display mt-6 max-w-[480px] text-4xl leading-tight text-balance md:text-5xl">
                See the same day through two signals.
              </h2>
              <p className="mt-6 max-w-[420px] text-base leading-6 text-pretty text-fg-2">
                The replay uses one captured day and one simulated building. Only the weather
                signal changes between Envo and the citywide baseline. Energy figures are modeled.
              </p>
              <Link
                href="/replay"
                className="mt-8 inline-flex items-center gap-2 rounded-sm border border-line px-3 py-2 text-base font-medium text-fg transition-colors duration-300 ease-out hover:border-fg-3"
              >
                See the whole day, hour by hour
              </Link>
            </Reveal>
            <Reveal delay={80}>
              <div className="relative grid sm:grid-cols-2">
                <span className="pointer-events-none absolute inset-0 hidden border border-line sm:block" aria-hidden="true" />
                <span className="pointer-events-none absolute top-0 bottom-0 left-1/2 hidden w-px bg-line sm:block" aria-hidden="true" />
                <span className="pointer-events-none absolute right-0 left-0 top-1/2 hidden h-px bg-line sm:block" aria-hidden="true" />
                <Tick mark="tl" />
                <Tick mark="tr" />
                <Tick mark="bl" />
                <Tick mark="br" />
                <Tick mark="mid" />
                <Stat label="Modeled peak cooling" value={`${run.metrics.peakWindowKwh.copilot.toFixed(1)} kWh`} note="Envo arm · same simulated building" />
                <Stat label="Modeled baseline" value={`${run.metrics.peakWindowKwh.baseline.toFixed(1)} kWh`} note="citywide signal · same simulated building" />
                <Stat label="Modeled difference" value={`${peakSaving.toFixed(1)}%`} note="assumptions shown in the replay" />
                <Stat label="Morning brief" value={`${fixtureBrief.items.length} actions`} note={`${fixtureBrief.headline.actNow} needing attention`} />
              </div>
            </Reveal>
          </div>
        </section>

        <div className="wash-to-night" aria-hidden="true" />
      </main>

      <footer>
        <section className="footer-cta px-5 py-20 md:px-12 md:py-24">
          <div className="relative z-10 mx-auto max-w-[1344px]">
            <h2 className="display max-w-[680px] text-4xl leading-tight text-balance text-fg md:text-6xl">
              See the same day through two signals.
            </h2>
            <Link
              href="/replay"
              className="mt-10 inline-flex rounded-sm bg-[#DDD8D5] px-3 py-2 text-base font-medium text-[#0B0907] transition-colors duration-300 ease-out hover:bg-fg"
            >
              See a real day
            </Link>
          </div>
        </section>

        <section className="bg-[#0B0907] px-5 pt-24 pb-16 md:px-12">
          <div className="mx-auto grid max-w-[1344px] gap-16 md:grid-cols-3">
            <FooterCol title="Product" links={[
              { href: '#problem', label: 'The signal' },
              { href: '#how', label: 'How it works' },
              { href: '#evidence', label: 'The evidence' },
              { href: '/replay', label: 'See a real day' },
              { href: '/onboarding', label: 'Try a building' },
            ]} />
            <FooterCol title="App" links={[
              { href: '/login', label: 'Sign in' },
              { href: '/app', label: 'Morning brief' },
              { href: '/app/sandbox', label: 'Sandbox' },
              { href: '/app/decisions', label: 'Decisions' },
              { href: '/app/autonomy', label: 'Autonomy' },
            ]} />
            <FooterCol title="Company" links={[
              { href: '/', label: 'Home' },
              { href: 'https://envy-main-v1.up.railway.app', label: 'UI v1 deployment', external: true },
              { href: '/replay', label: 'Replay' },
            ]} />
          </div>
          <div className="mx-auto mt-24 max-w-[1344px] font-mono text-xs tracking-[0.05em] text-fg-3">
            Simulation and advisory only. No real equipment is controlled.
          </div>
        </section>
      </footer>
    </div>
  );
}

function LiveOps() {
  return (
    <BracketFrame className="mx-auto w-full max-w-[1164px]">
      <div
        className="overflow-hidden rounded-sm border border-line bg-surface-2"
        role="img"
        aria-label={`A heatmap of ${tiles.sourceTiles} real FortyGuard tiles at ${tiles.granularityM} metres across Manhattan at ${tiles.time} on ${tiles.date}. This building's block reads ${cToF(tiles.buildingC).toFixed(1)} degrees Fahrenheit while the coolest block in the same grid reads ${cToF(tiles.minC).toFixed(1)}, a spread of ${spreadF.toFixed(1)} degrees at the same minute.`}
      >
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-4 py-3">
          <span className="font-mono text-xs tracking-[0.05em] text-fg-3">
            HEATMAP <b className="font-normal text-fg-2">{tiles.lat}, {tiles.lon}</b> · {tiles.granularityM} m · {tiles.date} {tiles.time}
          </span>
          <span className="inline-flex items-center gap-2 font-mono text-xs tracking-[0.05em] text-fg">
            <i className="live-dot size-1.5 rounded-full bg-[#FF8B3E]" aria-hidden="true" />
            LIVE
          </span>
        </header>

        <div
          className="relative w-full"
          style={{ aspectRatio: `${tiles.cols} / ${tiles.rows}` }}
        >
          <div className="absolute inset-0">
            <HeatGrid contain />
          </div>
        </div>

        <div className="grid grid-cols-2 border-t border-line md:grid-cols-4">
          <Cell label="THIS BLOCK" value={cToF(tiles.buildingC).toFixed(1)} unit="°F" tone="text-heat" />
          <Cell label="COOLEST BLOCK" value={cToF(tiles.minC).toFixed(1)} unit="°F" tone="text-fg-3" note="same grid, same minute" />
          <Cell label="SPREAD" value={spreadF.toFixed(1)} unit="°F" note="one number for all of them" />
          <Cell label="REAL TILES" value={String(tiles.sourceTiles)} unit={`@ ${tiles.granularityM} m`} tone="text-fg-2" last />
        </div>
      </div>
    </BracketFrame>
  );
}

function OrbitField() {
  return (
    <div className="relative mx-auto flex min-h-[420px] items-center justify-center">
      <svg className="absolute inset-0 size-full" viewBox="0 0 520 420" fill="none" aria-hidden="true">
        <ellipse className="orbit-stroke" cx="260" cy="210" rx="210" ry="78" stroke="#B1ACA6" pathLength="1" />
        <ellipse className="orbit-stroke" style={{ animationDelay: '180ms' }} cx="260" cy="210" rx="148" ry="128" stroke="#DFD8D3" pathLength="1" />
        <path className="orbit-stroke" style={{ animationDelay: '320ms' }} d="M80 210C80 210 180 320 260 320C340 320 440 210 440 210" stroke="#B1ACA6" pathLength="1" />
        <circle cx="80" cy="210" r="3" fill="#FF8B3E" />
        <circle cx="440" cy="210" r="3" fill="#5D5C57" />
        <circle cx="260" cy="320" r="3" fill="#5D5C57" />
      </svg>
      <div className="relative z-10 border border-[#1B1613] bg-[#FFF6E5] px-5 py-4">
        <div className="flex items-center justify-between gap-8 font-mono text-xs tracking-[0.05em] text-[#54504E]">
          <span>COMMAND SCHEMATIC</span>
          <span className="inline-flex items-center gap-2">
            <i className="live-dot size-1.5 rounded-full bg-[#FF8B3E]" aria-hidden="true" />
            LIVE
          </span>
        </div>
        <div className="mt-4 scale-90">
          <BuildingRig />
        </div>
      </div>
    </div>
  );
}

function HorizonMark() {
  return (
    <div className="flex flex-col items-center gap-3 text-[#1B1613]">
      <span className="font-mono text-xs tracking-[0.05em] text-[#3F3630]">OUTDOOR SIGNAL</span>
      <span className="display text-4xl">{cToF(run.tileTemperatureC).toFixed(1)}°</span>
    </div>
  );
}

function BracketFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative ${className ?? ''}`}>
      <span className="pointer-events-none absolute -left-px -top-px size-4 border-l border-t border-[#DDD8D5]" aria-hidden="true" />
      <span className="pointer-events-none absolute -right-px -top-px size-4 border-r border-t border-[#DDD8D5]" aria-hidden="true" />
      <span className="pointer-events-none absolute -bottom-px -left-px size-4 border-b border-l border-[#DDD8D5]" aria-hidden="true" />
      <span className="pointer-events-none absolute -bottom-px -right-px size-4 border-b border-r border-[#DDD8D5]" aria-hidden="true" />
      {children}
    </div>
  );
}

function Tick({ mark }: { mark: 'tl' | 'tr' | 'bl' | 'br' | 'mid' }) {
  const pos = {
    tl: 'top-0 left-0',
    tr: 'top-0 right-0',
    bl: 'bottom-0 left-0',
    br: 'bottom-0 right-0',
    mid: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
  }[mark];
  return (
    <span className={`pointer-events-none absolute hidden size-2 border-line sm:block ${pos}`} aria-hidden="true">
      <i className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-[#1B1613]" />
      <i className="absolute top-0 left-1/2 h-full w-px -translate-x-1/2 bg-[#1B1613]" />
    </span>
  );
}

function Cell({
  label, value, unit, tone = 'text-fg', note, last = false,
}: {
  label: string; value: string; unit: string; tone?: string; note?: string; last?: boolean;
}) {
  return (
    <div className={`border-b border-line px-4 py-4 md:border-b-0 ${last ? '' : 'md:border-r md:border-line'}`}>
      <div className="font-mono text-xs tracking-[0.05em] text-fg-3">{label}</div>
      <div className={`tabular mt-1 font-mono text-xl tracking-tight ${tone}`}>
        {value}<span className="ml-1 text-xs text-fg-3">{unit}</span>
      </div>
      {note ? <div className="mt-0.5 text-xs text-fg-3">{note}</div> : null}
    </div>
  );
}

function ProofRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-5">
      <dt className="font-mono text-xs tracking-[0.05em] text-fg-3">{label}</dt>
      <dd className="mt-2 text-base leading-6 text-pretty">{value}</dd>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="px-5 py-6">
      <div className="font-mono text-xs tracking-[0.05em] text-fg-3">{label}</div>
      <div className="display mt-5 text-4xl">{value}</div>
      <div className="mt-2 text-sm leading-5 text-fg-3">{note}</div>
    </div>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: Array<{ href: string; label: string; external?: boolean }>;
}) {
  return (
    <nav aria-label={title}>
      <h2 className="font-mono text-xs tracking-[0.08em] text-fg-3">{title.toUpperCase()}</h2>
      <ul className="mt-6 space-y-3">
        {links.map((link) => (
          <li key={link.href}>
            {link.external ? (
              <a
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="text-base text-fg transition-colors duration-300 ease-out hover:text-fg-2"
              >
                {link.label}
              </a>
            ) : (
              <Link href={link.href} className="text-base text-fg transition-colors duration-300 ease-out hover:text-fg-2">
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
