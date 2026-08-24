import { describe, expect, it } from 'bun:test';
import { INTERVAL_MS, alignToGrid, clockLabel, grid, intervalsInHours, isAligned }
  from '../src/utils/time';

describe('control grid', () => {
  it('aligns an arbitrary instant down to the interval', () => {
    const aligned = alignToGrid(new Date('2026-07-18T15:47:33.412Z'));
    expect(aligned.toISOString()).toBe('2026-07-18T15:00:00.000Z');
    expect(isAligned(aligned)).toBe(true);
  });

  it('leaves an already aligned instant untouched', () => {
    const at = new Date('2026-07-18T15:00:00.000Z');
    expect(alignToGrid(at).getTime()).toBe(at.getTime());
  });

  it('builds an inclusive grid', () => {
    const g = grid(new Date('2026-07-18T11:00:00Z'), new Date('2026-07-18T18:00:00Z'));
    expect(g).toHaveLength(8);
    expect(g.at(-1)!.toISOString()).toBe('2026-07-18T18:00:00.000Z');
    expect(g[1]!.getTime() - g[0]!.getTime()).toBe(INTERVAL_MS);
  });

  it('refuses off grid bounds rather than silently rounding', () => {
    expect(() => grid(new Date('2026-07-18T15:30:00Z'), new Date('2026-07-18T16:00:00Z'))).toThrow();
  });

  it('refuses a reversed range', () => {
    expect(() => grid(new Date('2026-07-18T16:00:00Z'), new Date('2026-07-18T15:00:00Z'))).toThrow();
  });

  it('counts intervals in the forecast horizon', () => {
    expect(intervalsInHours(12)).toBe(12);
  });

  it('labels the wall clock', () => {
    const at = new Date(2026, 6, 18, 15, 0);
    expect(clockLabel(at)).toBe('15:00');
  });
});
