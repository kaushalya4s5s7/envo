/**
 * Unit conversion. Assert, never assume.
 *
 * Normalization uses these so that a vendor changing units shows up as a failed
 * assertion rather than a silently wrong control decision.
 */

export const cToF = (c: number) => c * 9 / 5 + 32;
export const fToC = (f: number) => (f - 32) * 5 / 9;

/** Parts per billion from parts per million. */
export const ppmToPpb = (ppm: number) => ppm * 1000;
export const ppbToPpm = (ppb: number) => ppb / 1000;

/**
 * Cloud cover as a 0..1 fraction.
 *
 * ⚠️ The vendor field is named `cloud_cover_octas` but **returns percent**.
 * A live probe on 26 Aug 2026 produced `[70, 0, 17, 48, 29, …, 98]`. Reading it
 * as eighths over de rates the beam by roughly twelve times, and a 0..8
 * validator rejects real data outright.
 * See docs/reference/fortyguard/api.md, contradiction 1.
 */
export function cloudPercentToFraction(percent: number): number {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new RangeError(`cloud cover must be 0..100 percent, received ${percent}`);
  }
  return percent / 100;
}

/** Throw unless a value sits inside an expected range. Used at normalization boundaries. */
export function assertRange(name: string, value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${name} expected within ${min}..${max}, received ${value}`);
  }
  return value;
}
