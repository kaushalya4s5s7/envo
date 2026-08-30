import Link from 'next/link';
import { cToF, spreadF, tiles } from '@/lib/data';
import { Reveal } from './reveal';
import { HeatGrid } from './heat-grid';
import { BuildingRig } from './building-rig';

export function Hero() {
  return (
    <section className="flex flex-col items-center px-6 pt-24 pb-20 md:pt-[180px]">
      <div className="relative flex w-full flex-col items-center">
      {/* Decorative aside, not a layout column — the text below stays exactly
          centered on the page like the nav and the heatmap panel do. Only
          shown once there is genuinely spare gutter width to hold it. */}
      <div
        className="pointer-events-none absolute inset-y-0 hidden min-[1440px]:flex min-[1440px]:items-center"
        style={{ left: 'calc(50% + 360px)' }}
        aria-hidden="true"
      >
        <Reveal delay={400}>
          <BuildingRig />
        </Reveal>
      </div>

      <Reveal delay={120}>
        <span className="mb-8 inline-flex items-center gap-2 rounded-full border border-line bg-surface-2 px-3 py-1 text-xs font-medium text-fg-2">
          <span className="grid flex-none grid-cols-2 grid-rows-2 gap-px" aria-hidden="true">
            <i className="block size-[3px] bg-line" />
            <i className="block size-[3px] bg-heat" />
            <i className="block size-[3px] bg-smoke" />
            <i className="block size-[3px] bg-safe" />
          </span>
          Decision layer for building automation
        </span>
      </Reveal>

      <Reveal delay={230}>
        <h1 className="heading-gradient max-w-[680px] text-center text-3xl font-semibold tracking-tighter text-balance sm:text-4xl md:text-6xl md:leading-none">
          Your building knows<br />the weather.<br />Not your block.
        </h1>
      </Reveal>

      <Reveal delay={340}>
        <p className="mt-6 mb-5 max-w-[560px] text-center text-base text-pretty text-fg-2 md:text-sm">
          The next twelve hours of heat and sun for this block, turned into setpoint, shade, and
          damper commands your automation system already accepts.
        </p>
      </Reveal>

      <Reveal delay={450}>
        <Link
          href="/login"
          className="ease-fluid group inline-flex items-center gap-2 rounded-full bg-fg px-3 py-2 text-base font-semibold text-ink transition-all duration-500 hover:bg-fg-2 active:scale-[0.98]"
        >
          Get started
          <svg width="16" height="16" viewBox="0 0 256 256" fill="none" aria-hidden="true"
            className="ease-fluid transition-transform duration-500 group-hover:translate-x-0.5">
            <path d="M40 128h176M152 64l64 64-64 64" stroke="currentColor" strokeWidth="20"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </Reveal>
      </div>

      <Reveal delay={560} className="flex w-full justify-center">
        <div
          className="mt-16 w-full max-w-[1120px] overflow-hidden rounded-2xl border border-line bg-ink"
          role="img"
          aria-label={`A heatmap of ${tiles.sourceTiles} real FortyGuard tiles at ${tiles.granularityM} metres across Manhattan at ${tiles.time} on ${tiles.date}. This building's block reads ${cToF(tiles.buildingC).toFixed(1)} degrees Fahrenheit while the coolest block in the same grid reads ${cToF(tiles.minC).toFixed(1)}, a spread of ${spreadF.toFixed(1)} degrees at the same minute.`}
        >
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-4 py-3">
            <span className="font-mono text-xs text-fg-3">
              HEATMAP <b className="font-medium text-fg-2">{tiles.lat}, {tiles.lon}</b> · {tiles.granularityM} m · {tiles.date} {tiles.time}
            </span>
            <span className="flex items-center gap-4 text-xs text-fg-3">
              <span className="inline-flex items-center gap-1"><i className="block size-2 bg-line-2" />Cooler</span>
              <span className="inline-flex items-center gap-1"><i className="block size-2 bg-heat" />Hotter</span>
            </span>
          </header>

          <div className="grid grid-cols-1 min-[900px]:grid-cols-[1fr_232px]">
            <div className="min-[900px]:border-r min-[900px]:border-line"><HeatGrid /></div>
            <div className="grid grid-cols-2 border-t border-line min-[900px]:grid-cols-1 min-[900px]:border-t-0">
              <Cell label="THIS BLOCK" value={cToF(tiles.buildingC).toFixed(1)} unit="°F" tone="text-heat" />
              <Cell label="COOLEST BLOCK" value={cToF(tiles.minC).toFixed(1)} unit="°F" tone="text-fg-3"
                note="same grid, same minute" />
              <Cell label="SPREAD" value={spreadF.toFixed(1)} unit="°F" note="one number for all of them" />
              <Cell label="REAL TILES" value={String(tiles.sourceTiles)} unit={`@ ${tiles.granularityM} m`} tone="text-fg-2" />
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Cell({ label, value, unit, tone = 'text-fg', note }: {
  label: string; value: string; unit: string; tone?: string; note?: string;
}) {
  return (
    <div className="border-b border-line p-4 min-[900px]:last:border-b-0">
      <div className="font-mono text-xs tracking-wider text-fg-3">{label}</div>
      <div className={`tabular mt-1 font-mono text-xl font-medium tracking-tight ${tone}`}>
        {value}<span className="ml-1 text-xs text-fg-3">{unit}</span>
      </div>
      {note ? <div className="mt-0.5 text-xs text-fg-3">{note}</div> : null}
    </div>
  );
}
