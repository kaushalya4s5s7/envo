import artifact from './artifact.json';
import heatmap from './heatmap.json';

/**
 * The only data the site renders.
 *
 * `artifact.json` is produced by `bun artifact.ts` in core, from a real captured
 * FortyGuard day. `heatmap.json` holds real `tcm` tiles. The web app never
 * computes a decision: it renders what the agent already decided.
 */
export type Interval = (typeof artifact.intervals)[number];
export type Strategy = Interval['copilot'];
export type Decision = Strategy['decisions'][number];

export const run = artifact;
export const tiles = heatmap;

export const clock = (iso: string) => new Date(iso).toISOString().slice(11, 16);

export const cToF = (c: number) => c * 9 / 5 + 32;

/** Percent less cooling energy through the peak window. */
export const peakSaving =
  (1 - run.metrics.peakWindowKwh.copilot / run.metrics.peakWindowKwh.baseline) * 100;

export const spreadF = (tiles.maxC - tiles.minC) * 9 / 5;
