import { describe, expect, it } from 'bun:test';
import { assertRange, cToF, cloudPercentToFraction, fToC, ppbToPpm, ppmToPpb } from '../src/utils/units';

describe('units', () => {
  it('round trips temperature', () => {
    expect(cToF(0)).toBe(32);
    expect(fToC(212)).toBe(100);
    expect(fToC(cToF(23.5))).toBeCloseTo(23.5, 10);
  });

  it('round trips ozone concentration', () => {
    expect(ppmToPpb(0.086)).toBeCloseTo(86, 10);
    expect(ppbToPpm(86)).toBeCloseTo(0.086, 10);
  });

  /**
   * The field is named `cloud_cover_octas` but returns percent. Observed live
   * range was 0..98. See docs/reference/fortyguard/api.md, contradiction 1.
   */
  it('converts cloud cover from percent, despite the vendor field name', () => {
    expect(cloudPercentToFraction(0)).toBe(0);
    expect(cloudPercentToFraction(100)).toBe(1);
    expect(cloudPercentToFraction(50)).toBe(0.5);
  });

  it('accepts the full range real responses actually produce', () => {
    for (const observed of [0, 5, 17, 48, 70, 88, 98]) {
      expect(cloudPercentToFraction(observed)).toBeLessThanOrEqual(1);
    }
  });

  it('rejects cloud cover outside the percent range rather than clamping', () => {
    expect(() => cloudPercentToFraction(101)).toThrow(RangeError);
    expect(() => cloudPercentToFraction(-1)).toThrow(RangeError);
    expect(() => cloudPercentToFraction(Number.NaN)).toThrow(RangeError);
  });

  it('asserts rather than assumes at a normalization boundary', () => {
    expect(assertRange('pm25', 42, 0, 1000)).toBe(42);
    expect(() => assertRange('pm25', -1, 0, 1000)).toThrow(/pm25/);
  });
});
