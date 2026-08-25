import { describe, expect, it } from 'bun:test';
import { AIR, co2CeilingPpm } from '../src/utils';

/**
 * ANSI/ASHRAE 62.1-2022 sets the ceiling **relative to outdoor**, not absolutely:
 * no more than 700 ppm above the outdoor concentration. We hardcoded 1100, which
 * only holds if outdoor happens to be 400.
 *
 * FortyGuard returns `co2_ppm` hourly — observed 436 to 472 ppm over Manhattan on
 * 2026-08-29 — so the ceiling can be computed from the actual outdoor air instead
 * of assumed. idea.md Appendix B.
 */

describe('co2CeilingPpm', () => {
  it('is 700 above the measured outdoor concentration', () => {
    expect(co2CeilingPpm(450)).toBe(1150);
    expect(co2CeilingPpm(436)).toBe(1136);
  });

  it('falls back to the fixed ceiling when outdoor is unavailable', () => {
    expect(co2CeilingPpm(undefined)).toBe(AIR.CO2_CEILING_PPM);
    expect(co2CeilingPpm(null)).toBe(AIR.CO2_CEILING_PPM);
  });

  it('ignores an implausible outdoor reading rather than trusting it', () => {
    // A sensor returning indoor air, or a decimal error. Either would raise the
    // ceiling far past anything ASHRAE contemplates.
    expect(co2CeilingPpm(5000)).toBe(AIR.CO2_CEILING_PPM);
    expect(co2CeilingPpm(0)).toBe(AIR.CO2_CEILING_PPM);
  });

  it('never returns a ceiling at or above the hard limit', () => {
    expect(co2CeilingPpm(700)).toBeLessThan(AIR.CO2_HARD_PPM);
  });
});
