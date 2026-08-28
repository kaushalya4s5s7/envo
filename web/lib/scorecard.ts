import type { Arm, Experiment } from 'core/sandbox';
import { KPI_PLAIN } from './plain';

/**
 * The scorecard, derived from whatever the emulator returned.
 *
 * Nothing here is written by hand. If a future run reverses a result, the page
 * reverses with it — a hardcoded verdict would eventually become a false one,
 * and this is the page whose entire claim is that the scoring is not ours.
 */

export interface Metric {
  key: string;
  label: string;
  unit: string;
  /** One sentence explaining the row to someone seeing it for the first time. */
  hint: string;
  /** The emulator's own name for it, shown so the number stays checkable. */
  raw: string;
  decimals: number;
  /** Every KPI BOPTEST reports here is one where lower is better. */
  get: (e: Experiment, arm: Arm) => number | null;
}

const M = (key: keyof typeof KPI_PLAIN, raw: string, decimals: number,
           get: Metric['get']): Metric => ({
  key, raw, decimals, get,
  label: KPI_PLAIN[key]!.label, unit: KPI_PLAIN[key]!.unit, hint: KPI_PLAIN[key]!.hint,
});

export const METRICS: Metric[] = [
  M('energy', 'ener_tot', 4, (e, a) => e.arms[a].metrics.energyKwh),
  M('cost', 'cost_tot', 4, (e, a) => e.arms[a].metrics.costTotal),
  M('thermal', 'tdis_tot', 2, (e, a) => e.arms[a].metrics.thermalDiscomfort),
  M('air', 'idis_tot', 2, (e, a) => e.arms[a].metrics.airQualityDiscomfort),
  M('peak', 'pele_tot', 4, (e, a) => e.arms[a].metrics.peakElectricW),
];

export interface Delta {
  key: string;
  label: string;
  percent: number;
  better: boolean;
  negligible: boolean;
}

/** Copilot against a baseline arm, lower being better on every KPI above. */
export function deltas(e: Experiment, base: Arm): Delta[] {
  return METRICS.flatMap((m) => {
    const mine = m.get(e, 'copilot'), theirs = m.get(e, base);
    if (mine === null || theirs === null || theirs === 0) return [];
    const percent = ((mine - theirs) / Math.abs(theirs)) * 100;
    return [{
      key: m.key, label: m.label, percent,
      better: percent < 0, negligible: Math.abs(percent) < 0.05,
    }];
  });
}

/**
 * One sentence naming the tradeoff, built from the results.
 *
 * honesty-rails.md: a metric shown to a user is computed, never typed. That
 * applies hardest to the sentence that says whether we won.
 */
export function verdict(e: Experiment, base: Arm): string {
  const d = deltas(e, base).filter((x) => !x.negligible);
  const wins = d.filter((x) => x.better);
  const losses = d.filter((x) => !x.better);
  const list = (xs: Delta[]) =>
    xs.map((x) => `${x.label.toLowerCase()} ${Math.abs(x.percent).toFixed(1)}% ${x.better ? 'lower' : 'higher'}`)
      .join(', ');

  if (d.length === 0) return `Indistinguishable from the ${base} arm on every KPI the emulator reports.`;
  if (losses.length === 0) return `Better on every KPI that moved: ${list(wins)}.`;
  if (wins.length === 0) return `Worse on every KPI that moved: ${list(losses)}. The emulator scored this, and we are not hiding it.`;
  return `A tradeoff, not a clean win. Better on ${list(wins)}. Worse on ${list(losses)}.`;
}
