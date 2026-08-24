# Decision — Scope

**Status:** locked · **Confirm before Day 1:** the two 🔒 items below.

## 🔒 D1 — FortyGuard key tier

**Default: build tier-agnostic.** `weather-intel` exposes one `EnvSnapshot` contract; the tier only changes how it is filled.

| Tier | Behavior |
|---|---|
| **Premium** | Segmentation available → façade/roof context feeds tint. All params in one call per interval. |
| **Basic** | 3 params/call → **two calls per interval**. Call 1: `wet_bulb, pm25, dni`. Call 2: `apparent_temp, ozone, cloud_cover`. Segmentation unavailable → façade azimuth comes from static `building` metadata. |

Set `FORTYGUARD_TIER` in env. **On Basic, the pitch states the azimuth substitution openly.** Never imply segmentation you do not have.

## 🔒 D2 — Demo hero = **Policy C (air-quality override)**

Energy policies (A/B/D) are the supporting narrative. Impact is 40% of judging; health lands harder than kWh; C is the only policy anchored to a real dated event.

**Build order consequence:** Policy C ships first (T11), before pre-cool. If Day 2 runs long, A/B survive in reduced form and D is cut — C is never cut.

## In scope

Single building, single US city, one replayed day, 15-minute control interval, 12-hour forecast horizon, four actuators, simulated BMS.

## Out of scope — do not build

Real BMS integration · pressure/life-safety/fire modes · occupancy sensing · metered energy · multi-tenancy, auth, billing · non-US geography · sub-60 m resolution · live API calls during the demo (see [`../platform/determinism.md`](../platform/determinism.md)).

## Cut list — in this order, no debate

1. Policy D (demand response)
2. Portfolio view → single building
3. Ozone as second pollutant (PM2.5 alone carries Policy C)
4. Policy B refinements (keep basic tint, drop daylight floor)

**Never cut:** Policy C · the rationale panel · the split screen · the honesty rails.
