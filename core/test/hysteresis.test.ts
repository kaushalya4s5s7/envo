import { describe, expect, it } from 'bun:test';
import { AIR } from '../src/utils/thresholds';
import { firstEngagement, initialLatch, step, trace, transitionCount, type HysteresisSpec }
  from '../src/utils/hysteresis';

/** PM2.5 in US AQI index, per docs/reference/fortyguard/api.md. */
const PM25: HysteresisSpec = {
  engageAt: AIR.PM25_AQI_CLOSE,      // 151, EPA "Unhealthy"
  releaseAt: AIR.PM25_AQI_REOPEN,    // 101, EPA "USG"
  persistEngage: AIR.PERSIST_CLOSE,
  persistRelease: AIR.PERSIST_REOPEN,
};

/**
 * A spec with a two sample engage window. Deliberately NOT the product setting:
 * these tests prove the mechanism supports any persistence value, so changing
 * `AIR.PERSIST_CLOSE` is a product decision rather than a mechanism change.
 */
const SLOW: HysteresisSpec = { ...PM25, persistEngage: 2 };

describe('hysteresis', () => {
  it('rejects a spec whose release is not below its engage', () => {
    expect(() => step(initialLatch, 0, { ...PM25, releaseAt: PM25.engageAt })).toThrow();
  });

  it('does not engage on a single sample when two are required', () => {
    const states = trace([40, 180, 40, 40], SLOW);
    expect(states.every((s) => s.latch === 'released')).toBe(true);
  });

  it('engages only after the sustained run is met', () => {
    expect(firstEngagement([40, 180, 190, 200], SLOW)).toBe(2);
  });

  it('engages immediately when a single sample is enough', () => {
    expect(firstEngagement([40, 180], { ...PM25, persistEngage: 1 })).toBe(1);
  });

  it('stays engaged inside the dead band', () => {
    // AQI 130 sits between reopen (101) and close (151): neither engages nor releases.
    const states = trace([180, 190, 130, 130, 130, 130, 130], SLOW);
    expect(states.at(-1)!.latch).toBe('engaged');
  });

  it('releases only after the longer sustained run', () => {
    const values = [180, 190, /* engaged here */ 40, 40, 40, 40];
    const states = trace(values, SLOW);
    expect(states[2]!.latch).toBe('engaged');
    expect(states[3]!.latch).toBe('engaged');
    expect(states[4]!.latch).toBe('engaged');
    expect(states[5]!.latch).toBe('released'); // 4 consecutive clean samples
  });

  it('is asymmetric: releasing takes longer than engaging', () => {
    expect(PM25.persistRelease).toBeGreaterThan(PM25.persistEngage);
  });

  /**
   * The rail that matters. A naive single threshold comparison on this series
   * flips on every sample; hysteresis plus persistence must not.
   */
  it('does not chatter on a signal oscillating across one boundary', () => {
    const oscillating = Array.from({ length: 40 }, (_, i) =>
      AIR.PM25_AQI_CLOSE + (i % 2 === 0 ? 0.4 : -0.4),
    );
    const naive = oscillating.filter((v, i, a) =>
      i > 0 && (v >= AIR.PM25_AQI_CLOSE) !== (a[i - 1]! >= AIR.PM25_AQI_CLOSE)).length;
    expect(naive).toBeGreaterThan(30);            // the bug we are preventing
    expect(transitionCount(oscillating, SLOW)).toBeLessThanOrEqual(1);
  });
});
