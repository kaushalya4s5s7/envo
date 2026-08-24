/**
 * Every numeric constant in the system. Single source.
 *
 * Each value traces to docs/decisions/product/thresholds.md, which traces to an
 * external standard so it is defensible under questioning. Inventing a number here,
 * or inlining one in a policy, is a bug.
 *
 * ⚠️ The EPA breakpoints below are recorded from the decision doc and are pending
 * re-verification against the current AQI table (milestone M6.1).
 */

/**
 * Control interval, minutes.
 *
 * ⚠️ Provisional. FortyGuard does not document its native step: the schema shows
 * `metadata.time_range.interval` as a placeholder. Every `filter_type` is hour
 * granular, which points to 60, but that is inference. The real value is read
 * from the response into `EnvSnapshot.intervalMin`; this constant is only the
 * fallback used by fixtures and tests until a live call confirms it.
 *
 * See docs/plans/milestones.md B5.
 */
export const INTERVAL_MIN = 60;
/** Forecast horizon, hours. */
export const FORECAST_HORIZON_H = 12;

/** Policy A — pre cool. */
export const PRECOOL = {
  /** Apparent temperature, °F, that marks peak load territory. */
  TRIGGER_F: 95,
  /** Setpoint shift, °F. Occupant imperceptible; matches a typical demand response shift. */
  DELTA_F: 2,
  /** Thermal mass charge time for a mid rise, minutes. */
  RAMP_MIN: 90,
  /** Skip pre cooling if the peak is already this close, °F. */
  HEADROOM_F: 6,
} as const;

/** Policy B — tint. Beam already projected onto the facade and de rated for cloud. */
export const TINT = {
  /** W/m² on facade above which cooling penalty dominates daylight benefit. */
  HIGH_WM2: 500,
  MID_WM2: 250,
  /** Below this work plane illuminance, lighting load exceeds cooling savings. */
  DAYLIGHT_FLOOR_LUX: 300,
} as const;

/**
 * Policy C — air quality override.
 *
 * ⚠️ Expressed in **US AQI index**, because FortyGuard returns `air_quality_*:idx`
 * fields as AQI rather than concentration. An earlier version of this file used
 * µg/m³ and ppb, which were the wrong units for this data source.
 *
 * The anchors are unchanged: EPA category boundaries. AQI 151 is exactly the
 * index at which PM2.5 reaches 55.5 µg/m³ and ozone reaches its Unhealthy
 * breakpoint, so the intent survived the unit correction.
 */
export const AIR = {
  /** AQI. Lower bound of EPA "Unhealthy". */
  /**
   * US AQI, not µg/m³. AQI 151 is the lower bound of the EPA **Unhealthy**
   * category, which for PM2.5 24 h begins at 55.5 µg/m³.
   * https://aqs.epa.gov/aqsweb/documents/codetables/aqi_breakpoints.html
   */
  PM25_AQI_CLOSE: 151,
  /** AQI. Lower bound of EPA "Unhealthy for Sensitive Groups". */
  PM25_AQI_REOPEN: 101,
  /** AQI. Lower bound of EPA "Unhealthy". */
  /**
   * US AQI. AQI 151 for 8 h ozone begins at 0.086 ppm, the EPA **Unhealthy**
   * breakpoint. Verified 29 Aug 2026 against the EPA AQS table.
   */
  O3_AQI_CLOSE: 151,
  /** AQI. Upper bound of EPA "Moderate". */
  O3_AQI_REOPEN: 100,
  /**
   * Intervals sustained before closing.
   *
   * One, because FortyGuard's native step is hourly. Requiring two meant a real
   * ozone event on 2026-08-07 that touched AQI 151 for a single hour was missed
   * entirely, and two hours of sustained Unhealthy air before protecting
   * occupants is the wrong tradeoff for a health rail. Decided on safety
   * grounds, not to flatter a demo. See milestones B5.
   */
  PERSIST_CLOSE: 1,
  /**
   * Intervals sustained before reopening. Deliberately longer, and now much
   * more so: quick to protect, slow to trust clean air.
   */
  PERSIST_REOPEN: 4,
  /**
   * ppm. Common indoor air quality ceiling, roughly 700 above outdoor.
   * Crossing it starts the search for the cleanest hour to flush in.
   */
  /**
   * ppm. Operating ceiling.
   *
   * Sourced. ANSI/ASHRAE 62.1-2022 recommends steady state indoor CO₂ no more
   * than **700 ppm above outdoor**, and outdoor is typically 300 to 500 ppm,
   * which puts the ceiling at roughly 1000 to 1200. 1100 sits inside that band.
   *
   * ASHRAE is explicit that this value exists to set demand controlled
   * ventilation setpoints and is **not an indoor air quality indicator**. Copy
   * must not describe CO₂ as an air quality measure. idea.md Appendix B.
   */
  CO2_CEILING_PPM: 1100,
  /**
   * ppm. Flush **now**, whatever the outdoor air is doing.
   *
   * The ceiling alone is not enough: on a day where outdoor air improves
   * monotonically, "now" is never the cleanest hour and the search defers
   * forever. On the captured 2026-08-07 day that let CO₂ reach 1622 ppm.
   * See docs/decisions/platform/sandbox-findings.md.
   */
  CO2_HARD_PPM: 1500,
  /**
   * ppm. Stop purging and allow the intake to seal again.
   *
   * The purge needs a release value like every other threshold in this system.
   * With only an engage value it opened for one interval, resealed, and
   * oscillated. honesty-rails.md rail 1.
   */
  CO2_PURGE_CLEAR_PPM: 800,
  /** Outside air fraction the building returns to once the air is clean again. */
  NORMAL_OA_FRACTION: 0.2,
  /**
   * Outside air fraction held **during** an air quality event.
   *
   * Reduce, never eliminate. Shutting the intake to zero traded one hazard for
   * another: BOPTEST scored a fully sealed office at 219× the indoor air quality
   * penalty of doing nothing, because CO₂ rose 230 ppm/h with the occupants
   * still breathing. Wildfire guidance is to modulate the damper down, not shut
   * it. docs/decisions/platform/sandbox-findings.md
   */
  SEAL_OA_FRACTION: 0.1,
} as const;

/** Policy D — demand response. */
export const DR = {
  /** Bid when portfolio forecast load reaches this fraction of modeled peak. */
  BID_TRIGGER: 0.85,
  /** Fraction of the portfolio that must be pre cooled before bidding. */
  MIN_PRECOOL_FRACTION: 0.6,
} as const;

/** Comfort bounds during occupancy. Policies A, B, D optimize only inside these. */
export const COMFORT = {
  T_MIN_F: 68,
  T_MAX_F: 78,
  /**
   * Nominal occupied setpoint, the value the building holds when nothing is
   * intervening. Pre cooling targets an offset from **this**, never from the
   * current setpoint, or it would ratchet the building down every interval.
   */
  SETPOINT_F: 72,
} as const;

/** Operators distrust systems that move constantly. */
export const MAX_CHANGES_PER_HOUR = 4;

/**
 * Outdoor CO₂ concentrations that are physically plausible for ambient air.
 * Anything outside this is a sensor reading indoor air or a unit error, and
 * trusting it would raise the ventilation ceiling on bad data.
 */
const PLAUSIBLE_OUTDOOR_CO2 = { min: 300, max: 800 } as const;

/** ppm above outdoor, per ANSI/ASHRAE 62.1-2022. */
export const CO2_ABOVE_OUTDOOR_PPM = 700;

/**
 * The operating CO₂ ceiling, computed from the measured outdoor concentration.
 *
 * ASHRAE 62.1 expresses this ceiling **relative to outdoor** — no more than 700
 * ppm above it — so a fixed 1100 is only correct when outdoor happens to be 400.
 * FortyGuard returns `co2_ppm` hourly (436 to 472 ppm observed over Manhattan on
 * 2026-08-29), so the ceiling is derived rather than assumed.
 *
 * Falls back to the fixed constant when outdoor is unavailable or implausible.
 * A missing reading must not silently raise a ventilation threshold.
 */
export function co2CeilingPpm(outdoorPpm: number | null | undefined): number {
  if (
    typeof outdoorPpm !== 'number' || !Number.isFinite(outdoorPpm) ||
    outdoorPpm < PLAUSIBLE_OUTDOOR_CO2.min || outdoorPpm > PLAUSIBLE_OUTDOOR_CO2.max
  ) {
    return AIR.CO2_CEILING_PPM;
  }
  return outdoorPpm + CO2_ABOVE_OUTDOOR_PPM;
}
