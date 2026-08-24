import { z } from 'zod';

/**
 * The normalized outdoor signal. **This shape is ours, not the vendor's.**
 *
 * Normalization converts at the boundary so nothing downstream deals in vendor
 * units. Two conversions matter, both verified against the FortyGuard docs:
 *
 *   - FortyGuard returns every temperature in °C. We work in °F because US
 *     building controls, comfort bounds, and the thresholds doc are all °F.
 *   - FortyGuard air quality fields ending `:idx` are **US AQI index values**,
 *     0 to 500, not concentrations. We keep them as AQI rather than back
 *     converting, because AQI is what the thresholds are anchored to.
 *
 * See docs/reference/fortyguard/api.md.
 */

/** US AQI index. 0 to 500. Not µg/m³, not ppb. */
export const AqiIndex = z.number().min(0).max(500);

export const EnvReading = z.object({
  /** Aligned to the control grid. */
  at: z.coerce.date(),
  /** Feels like temperature, °F. From `apparent_temperature_celsius`. */
  apparentTempF: z.number(),
  /** Wet bulb, °F. From `wet_bulb_temperature_celsius`. Determines free cooling availability. */
  wetBulbF: z.number(),
  /** AQI index for PM2.5. From `air_quality_pm2p5:idx`. */
  pm25Aqi: AqiIndex,
  /** AQI index for ozone. From `air_quality_o3:idx`. */
  ozoneAqi: AqiIndex,
  /**
   * Cloud cover, **percent**. From `cloud_cover_octas`, whose name is misleading:
   * the field returns 0..100, observed live up to 98.
   */
  cloudCoverPercent: z.number().min(0).max(100),
  /**
   * Outdoor CO₂, ppm. From `co2_ppm`. Optional because fixtures captured before
   * we requested it do not carry it, and a missing value must fall back rather
   * than raise a ventilation ceiling. See `co2CeilingPpm`.
   */
  outdoorCo2Ppm: z.number().positive().optional(),
  /**
   * Everything else FortyGuard returns for this location.
   *
   * **Display only.** No policy may read this: a threshold belongs in
   * `utils/thresholds.ts` with a source behind it, and a field that reaches a
   * decision needs to be a named part of the contract instead.
   */
  ambient: z.object({
    heatIndexF: z.number().optional(),
    relativeHumidityPercent: z.number().optional(),
    precipitationMm: z.number().optional(),
    overallAqi: z.number().optional(),
    pm10Aqi: z.number().optional(),
    no2Aqi: z.number().optional(),
    coAqi: z.number().optional(),
    so2Aqi: z.number().optional(),
    methanePpb: z.number().optional(),
  }).optional(),
});
export type EnvReading = z.infer<typeof EnvReading>;

/**
 * Clear sky irradiance, W/m².
 *
 * FortyGuard returns this once per location rather than once per timestamp, and
 * it is explicitly clear sky. It must be de rated by `cloudOktas` before any
 * tint decision, and it cannot be assumed to vary across the time axis.
 */
export const ClearSkyIrradiance = z.object({
  ghiWm2: z.number().nonnegative(),
  dniWm2: z.number().nonnegative(),
  dhiWm2: z.number().nonnegative(),
});
export type ClearSkyIrradiance = z.infer<typeof ClearSkyIrradiance>;

export const EnvSnapshot = z.object({
  segmentId: z.string().min(1),
  /** IANA zone from `metadata.timezone`. Decisions are made in local time. */
  timezone: z.string().min(1),
  /**
   * Minutes between readings, read from `metadata.time_range.interval`.
   * Never hardcoded: the vendor does not document a fixed value.
   */
  intervalMin: z.number().int().positive(),
  now: EnvReading,
  /** Forward readings, ascending, excluding `now`. Horizon is capped at 12 h by the vendor. */
  forecast: z.array(EnvReading),
  clearSky: ClearSkyIrradiance,
});
export type EnvSnapshot = z.infer<typeof EnvSnapshot>;
