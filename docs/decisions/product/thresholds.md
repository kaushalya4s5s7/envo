# Decision — Thresholds

**Status:** locked · **Product law.** Do not "tune" these to make a demo look better. Change the file, not the code.

All thresholds are **anchored to external standards** so they are defensible under questioning. Invented numbers are the easiest thing for a judge to attack.

> ⚠️ **Day 3 task:** re-verify the EPA AQI breakpoint table before any number is spoken aloud. See [`../../plans/2026-08-27-build.md`](../../plans/2026-08-27-build.md) T21.

## Control interval

`FORECAST_HORIZON_H = 12` — a hard vendor ceiling, not a choice.

`INTERVAL_MIN = 60` — **provisional.** FortyGuard does not document its native step; the schema
leaves `metadata.time_range.interval` as a placeholder. Every `filter_type` is hour granular, which
points to hourly. The real value is read from the response into `EnvSnapshot.intervalMin`.

> ⚠️ **This changes what persistence means.** At an hourly grid, `PERSIST_CLOSE = 2` is two
> **hours** of sustained unhealthy air before the intake shuts, not thirty minutes. That is likely
> too slow for a health override. See milestones B5 — needs a decision once the real interval is known.

## Policy A — Pre-cool

| Key | Value | Anchor |
|---|---|---|
| `PRECOOL_TRIGGER_F` | 95 (apparent) | Peak-load territory, most US climate zones |
| `PRECOOL_DELTA_F` | 2.0 | Occupant-imperceptible; matches typical DR setpoint shift |
| `PRECOOL_RAMP_MIN` | 90 | Thermal-mass charge time, mid-rise |
| `PRECOOL_HEADROOM_F` | 6 | Prevents pre-cooling when already at peak |

## Policy B — Tint

| Key | Value | Anchor |
|---|---|---|
| `TINT_HIGH_WM2` | 500 (beam on façade) | Cooling penalty dominates daylight benefit |
| `TINT_MID_WM2` | 250 | Transitional |
| `DAYLIGHT_FLOOR_LUX` | 300 (work plane) | Below this, lighting load exceeds cooling savings |

Beam is projected onto façade azimuth **then** de-rated by `cloud_cover_octas`. Both steps are mandatory.

## Policy C — Air-quality override

| Key | Value | Anchor |
|---|---|---|
| `PM25_CLOSE` | 55.5 µg/m³ (24 h) | EPA "Unhealthy" breakpoint |
| `PM25_REOPEN` | 35.4 µg/m³ | EPA "USG" lower bound |
| `O3_CLOSE_PPB` | 86 (8 h) | EPA "Unhealthy" breakpoint |
| `O3_REOPEN_PPB` | 70 | EPA "Moderate" upper bound |
| `SEAL_OA_FRACTION` | 0.10 | Outside air held **during** an event. Reduce, never eliminate: a fully sealed office scored 219× the IAQ penalty of doing nothing, because CO₂ climbed 230 ppm/h with occupants still breathing. |
| `NORMAL_OA_FRACTION` | 0.20 | Returned to once the air is clean |
| `PERSIST_CLOSE` | **1 interval** | The vendor's step is hourly. Two meant a real ozone event touching AQI 151 for one hour was missed entirely, and waiting two hours above Unhealthy before acting is the wrong tradeoff for a health rail. Changed on safety grounds. |
| `PERSIST_REOPEN` | 4 intervals | **Asymmetric**, now four times the close window. Quick to protect, slow to trust clean air. |
| `CO2_CEILING_PPM` | 1100 | Common IAQ ceiling (~700 above outdoor) |

## Policy D — Demand response

| Key | Value |
|---|---|
| `DR_BID_TRIGGER` | portfolio forecast load ≥ 85% of modeled peak |
| `MIN_PRECOOL_FRACTION` | 0.6 of portfolio successfully pre-cooled |

## Comfort + rate limits

| Key | Value | Why |
|---|---|---|
| `T_MIN_F` / `T_MAX_F` | 68 / 78 (occupied) | Hard comfort bound — Policies A/B/D optimize only inside it |
| `SETPOINT_F` | 72 | Nominal occupied setpoint. **Pre cooling targets an offset from this, never from the current setpoint**, which would ratchet the building down every interval. |
| `MAX_CHANGES_PER_HOUR` | 4 per actuator | Operators distrust systems that move constantly |

## Implementation rule

Every threshold pair with an open and close value **must** be implemented via the shared hysteresis helper in `core/utils`. A single-threshold comparison anywhere in `policies` is a bug.
