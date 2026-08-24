/** The 15 minute control grid. Everything downstream assumes this alignment. */

import { INTERVAL_MIN } from './thresholds';

export const INTERVAL_MS = INTERVAL_MIN * 60_000;

/** Round an instant down to the control grid. */
export function alignToGrid(at: Date): Date {
  return new Date(Math.floor(at.getTime() / INTERVAL_MS) * INTERVAL_MS);
}

export function isAligned(at: Date): boolean {
  return at.getTime() % INTERVAL_MS === 0;
}

/** Inclusive grid of instants from `from` to `to`. Throws if either is off grid. */
export function grid(from: Date, to: Date): Date[] {
  if (!isAligned(from) || !isAligned(to)) throw new Error('grid bounds must be aligned to the control interval');
  if (to < from) throw new Error('grid end must not precede its start');
  const out: Date[] = [];
  for (let t = from.getTime(); t <= to.getTime(); t += INTERVAL_MS) out.push(new Date(t));
  return out;
}

/** How many intervals fit in a span of hours. */
export function intervalsInHours(hours: number): number {
  return Math.round((hours * 60) / INTERVAL_MIN);
}

/** Local wall clock label, `HH:MM`. */
export function clockLabel(at: Date): string {
  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
}
