# FortyGuard — working contract

Distilled from the raw pages in this folder. **Those pages are the source; this is the working
summary.** If the two disagree, the raw page wins and this file gets fixed.

Verified against docs supplied 27 Aug 2026. Anything not stated here was not documented — do not
infer it.

## Transport

| | |
|---|---|
| Base | `https://api.fortyguard.com/v1` |
| Auth | header `api-key: <KEY>`. No OAuth, no token exchange. |
| Content | `Content-Type: application/json` |
| Shape | **Every analysis call is async.** POST returns `data.activity_id`; poll `GET /v1/status/{activity_id}`. |
| Region | **United States only**, all plans |

### Endpoints

| Method | Path | Plan |
|---|---|---|
| POST | `/v1/heatmap` | Both |
| POST | `/v1/env_params` | Both |
| POST | `/v1/satellite` | Premium |
| POST | `/v1/streetview` | Premium |
| POST | `/v1/heat_intelligence` | Premium |
| GET | `/v1/status/{activity_id}` | Both |

### Status lifecycle

`Processing` → keep polling · `Completed` → result is in the same response body · `Failed` → terminal, stop, record the id.

The quickstart also accepts `succeeded` / `error` when lower cased, so **compare case insensitively and treat both spellings as terminal.**

| Code | Meaning |
|---|---|
| 400 / 422 | Invalid request or validation error |
| 401 | Missing or invalid key |
| 403 | Plan does not include this endpoint |
| 404 | Activity not found, **including briefly right after submission** — do not treat as fatal on the first polls |
| 429 | Rate limited |
| 500 | Server side failure |

Credits are deducted **only** on `Completed`. Failed tasks are free.

## Plans

| | Basic | Premium | Startup |
|---|---|---|---|
| Monthly credits | 1,000,000 | 5,000,000 | 1,000,000 one time, 6 months |
| Heatmap max area | 10 mi² | 50 mi² | 10 mi² |
| **Environmental parameters** | **3 per request** | all | **3 per request** |
| Satellite / Street / Heat Intelligence | ✗ | ✓ | ✗ |

## Shared input constraints

- Coordinates within the United States. Latitude −90..90, longitude −180..180.
- `polygon_aoi` is a GeoJSON `FeatureCollection` with a **closed** Polygon (first coordinate equals last).
- Dates `YYYY-MM-DD`, times `HH:MM` 24 hour.
- **Valid window: 2019-01-01 through now + 12 hours.** That upper bound is the entire forecast capability.
- `granularity` is a **number**: `60`, `80`, or `100`. Not a string, no `m` suffix.
- Violations return 400 and are **not** charged.

### filter_type

| Value | Meaning | Requires |
|---|---|---|
| 1 | Single hour | `start_date`, `start_time` |
| 2 | Range of hours, same day, **max 23 h** | `start_date`, `start_time`, `end_time` |
| 3 | Single day, 00:00 to 23:59 | `start_date` |
| 4 | Range of days, ≤ 1 month | `start_date`, `end_date` — **`/v1/heatmap` only** |

## POST /v1/heatmap

Required: `polygon_aoi`, `date_time`, `granularity`.
Optional: `analytic_type` (default `tcm`), `threshold` (default 30 °C), `direction` (default `above`).

| `analytic_type` | Returns |
|---|---|
| `tcm` | **Temperature in °C per tile.** This is the one we need. |
| `time_of_measure` | Hour of day 0–23 **UTC** of peak temperature |
| `exceedance` | Count of hours past `threshold` |
| `persistence` | Longest continuous run of hours past `threshold` |

Result: `result.map_data` (GeoJSON FeatureCollection of tiles) and `result.stats_data`
(min, max, mean, standard deviation, distributions, frequency histogram).

## POST /v1/env_params

Required: `latitude`, `longitude`, **`temperature` (°C)**, `date_time`.
Optional: `analysis` — omit for all parameters; **Basic and Startup cap it at 3**.

> ### The chain is mandatory, not stylistic
> `temperature` is a **required input**. It is the °C value for this location, and it comes from
> the `tcm` heatmap tile covering it. So:
>
> `POST /v1/heatmap (tcm)` → poll → read the tile temperature → `POST /v1/env_params` → poll
>
> The docs also state the date and time **should match the heatmap** you generated for that
> location. There is no way to skip the heatmap.

### Parameter names, exactly

Thermal and atmospheric — **all temperatures °C**:
`heat_index_celsius` · `apparent_temperature_celsius` · `wet_bulb_temperature_celsius` ·
`relative_humidity_percent` · `precipitation_mm` · `cloud_cover_octas` · `elevation`

Air quality — **all `:idx` fields are US AQI index values, 0 to 500. Not concentrations.**
`air_quality:idx` · `air_quality_pm2p5:idx` · `air_quality_pm10:idx` · `air_quality_no2:idx` ·
`aqi_us_co` · `air_quality_o3:idx` · `air_quality_so2:idx` · `methane_ppb` · `co2_ppm`

Solar: `solar_irradiance` → `clear_sky.ghi`, `clear_sky.dni`, `clear_sky.dhi`

### Result shape

```
result.metadata.timezone, timezone_offset_hours
result.metadata.time_range.{start, end, interval, count}
result.metadata.timestamps[]                    ← the time axis
result.locations[].{lat, lon, elevation, temperature}
result.locations[].parameters.<name>[]          ← arrays, aligned to timestamps
result.locations[].solar_irradiance.clear_sky.{ghi, dni, dhi}
```

## Traps

| # | Trap |
|---|---|
| 1 | **AQI, not concentration.** `air_quality_pm2p5:idx` is an index. Any threshold expressed in µg/m³ or ppb is in the wrong unit. |
| 2 | **Celsius.** Every temperature parameter is °C. Convert at the normalization boundary, never deeper. |
| 3 | **`heat_intelligence` takes °F while `env_params` takes °C.** Same concept, different unit, same API. Assert on both. |
| 4 | **`solar_irradiance` is clear sky**, and is a single object per location rather than an array aligned to `timestamps`. Cloud de rating with `cloud_cover_octas` is therefore mandatory, and beam is **not** available per timestamp from one call. |
| 5 | **`null` means unavailable, never zero.** Legacy stored responses may carry `-999`. Both must propagate as missing, not as a reading. |
| 6 | **`interval` is undocumented.** `time_range.interval` is a placeholder in the schema. Read it from the response; do not hardcode a step. All `filter_type` values are hour granular, which points to hourly, but that is inference, not fact. |
| 7 | `time_of_measure` is **UTC** while `metadata` carries a local timezone offset. |
| 8 | 404 is expected briefly after submission. Retry before failing. |
| 9 | `persistence` here is a **heatmap analytic**, the longest run of hours past a temperature threshold. It is unrelated to control loop persistence and cannot be used for sustained trigger logic. |
| 10 | Basic allows 3 parameters per request, so the six we need cost **two** `env_params` calls per timestamp. |

## Call plan for this project

We need six parameters: `wet_bulb_temperature_celsius`, `apparent_temperature_celsius`,
`air_quality_pm2p5:idx`, `air_quality_o3:idx`, `cloud_cover_octas`, `solar_irradiance`.

**Premium** — one `env_params` call, omit `analysis` entirely.

**Basic** — two calls, same `latitude`, `longitude`, `temperature`, `date_time`:

| Call | `analysis` |
|---|---|
| 1 | `wet_bulb_temperature_celsius`, `air_quality_pm2p5:idx`, `solar_irradiance` |
| 2 | `apparent_temperature_celsius`, `air_quality_o3:idx`, `cloud_cover_octas` |

Use `filter_type: 2` to pull a whole span of hours in one task rather than one call per hour.
A full replay day is then roughly: 1 heatmap + 2 env_params on Basic, or 1 + 1 on Premium.

## Still unknown

Not in the supplied docs. Ask before relying on any of it.

- The native `interval` value
- Rate limit numbers behind 429, and any concurrency cap
- Credit cost per endpoint
- Tile schema inside `map_data` — property names for temperature and tile geometry
- Whether `solar_irradiance` ever varies across `timestamps`
- `GET` path for credits usage

---

# Observed reality — live probe, 27 Aug 2026

Everything below comes from **actual responses**, saved in [`samples/`](samples/). Where it
contradicts the written docs, the observed behaviour wins. Premium key.

## Resolved

| Question | Answer |
|---|---|
| Native `interval` | **`"1h"`.** Hourly, confirmed. `time_range.count` matched the requested span exactly (17 hours → 17 readings). |
| Plan | **Premium.** `/v1/satellite` returned 200 rather than 403, so all parameters come in one call and segmentation is available. |
| Task latency | Heatmap over a 0.012° box at 60 m: **~16 s**. 276 tiles. |
| Tile schema | `properties: { tile_id, average_temperature, min_temperature, max_temperature }`, all °C. `geometry.type: "Polygon"`. |

## Contradictions and traps found live

| # | What the docs say | What actually happens |
|---|---|---|
| 1 | `cloud_cover_octas` — "effective cloud cover, octas" | **Values are percent, 0 to 100.** Observed range `0 … 98`. Treating it as eighths silently over de rates the beam by ~12×, and a 0..8 validator rejects real data outright. |
| 2 | `stats_data.Temperature_stats` | Key is **lowercase**: `temperature_stats`. Same for the other stats keys. |
| 3 | `solar_irradiance` implied per location | It is a **period average across the whole requested range**, stated in its own `description` field: "average solar energy available … over a total of 17 hours". One `filter_type: 2` call therefore yields **one** DNI value, not a series. |
| 4 | `metadata.timezone` | Returned `"GMT-5"` with `timezone_offset_hours: -5` for New York on **26 Aug**, which is EDT (`-4`). It appears to report **standard** offset and ignore daylight saving. Do not derive local wall clock from it without checking. |
| 5 | `heat_index_celsius` presented alongside apparent temperature | Observed nearly **flat**: 25.0 to 25.7 °C across a day where apparent temperature swung 17.1 to 28.0. Use `apparent_temperature_celsius`; heat index looks degenerate at this location. |

## Also worth knowing

- **`co2_ppm` is outdoor CO₂**, 431 to 448 ppm observed. Usable as the twin's outdoor background instead of a constant.
- **`air_quality:idx` tracked `air_quality_pm2p5:idx` exactly** in this sample, so overall AQI was PM2.5 driven.
- **No nulls at all** in 17 readings across 15 parameters. Missing value handling still has to exist, but it is not the common case.
- Ozone AQI moved 14.8 → 70.5 across the day while PM2.5 stayed 53.6 → 59.0. **The two pollutants genuinely have different drivers**, which justifies latching them separately.

## Cost of a replay day

One `/heatmap` (`filter_type: 2`) plus one `/env_params` (`filter_type: 2`) gives a full hourly day
of everything except irradiance. Hourly DNI needs **one `filter_type: 1` call per hour**, so a
17 hour day costs 17 extra tasks. Decide whether the tint policy needs hourly beam or whether the
daily average plus solar geometry is enough.

---

# Resolution limits — the finding that reshaped the product

Probed live on 27 Aug 2026 with a Premium key. Evidence in
[`samples/resolution-probe.json`](samples/resolution-probe.json). **Read this before making any
claim about what is hyperlocal.**

## What varies at 60 to 100 m, and what does not

| Signal | Spatial resolution | Temporal resolution |
|---|---|---|
| **Temperature** (`tcm` heatmap, apparent, wet bulb) | ✅ **Genuinely per tile.** 4265 distinct tiles across 23 mi²; 1.58 °C (2.8 °F) between the hottest and coolest block **in the same minute**. | ✅ Hourly |
| **Ozone** (`air_quality_o3:idx`) | ❌ Metro scale | ✅ **Hourly.** Observed 36.4 → 79.8 → 40.5 across one day. |
| **PM2.5** (`air_quality_pm2p5:idx`) | ❌ Metro scale | ❌ **Daily.** Effectively constant within a day. |

### The two probes that settled it

**Spatially.** Same hour, 2023-06-07 15:00:

| Location | PM2.5 AQI | Ozone AQI | Apparent °C |
|---|---|---|---|
| Midtown Manhattan | 156 | 49.6 | 20.3 |
| Newark, ~15 km | **156** | **49.6** | 21.4 |
| Philadelphia, ~130 km | 144.9 | 67.3 | 22.4 |

Air quality is **identical across 15 km**. Apparent temperature is not.

**Temporally.** Single hour calls on 2023-06-07, the Canadian wildfire smoke day: PM2.5 read
**156.2 at 08:00 and 156.1 at 20:00**, on a day New York went from roughly 50 to over 400. Ozone
over the same pair moved 37.1 → 58.6.

## Consequences

- **Never claim hyperlocal air quality.** A "your block versus the citywide average" comparison on
  PM2.5 or ozone is not supported: both numbers would be the same.
- **Do claim hyperlocal heat.** It is the product's real core, and it is measurably true.
- **Ozone is the usable air quality signal** for anything time sensitive, including scheduling a
  CO₂ purge into the cleanest hour ahead. PM2.5 is a daily baseline, not an event trace.
- For a single hour request, `min_temperature` equals `max_temperature` equals
  `average_temperature` per tile. The wide per tile ranges seen earlier were **temporal** spread
  across a `filter_type: 2` window, not spatial.
