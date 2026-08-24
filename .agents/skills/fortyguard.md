# Skill — FortyGuard

**Verified** against the docs in [`docs/reference/fortyguard/`](../../docs/reference/fortyguard/)
on 27 Aug 2026. The distilled contract is [`api.md`](../../docs/reference/fortyguard/api.md);
read that before writing client code. This file is the project specific playbook on top of it.

All implementation lives in `core/src/weather/fortyguard/`. Nothing leaks past `core/src/weather/`.

## The chain is mandatory

```
POST /v1/heatmap  (analytic_type: tcm)  →  activity_id
GET  /v1/status/{id}  until Completed   →  map_data tiles, °C per tile
read the tile covering the building     →  temperature °C
POST /v1/env_params  (that temperature) →  activity_id
GET  /v1/status/{id}  until Completed   →  parameters aligned to timestamps
```

`env_params` **requires** `temperature` in °C as an input, and its date and time should match the
heatmap. The heatmap is not optional context, it is an input dependency. Getting this right is also
a cheap credibility marker in the pitch.

## Non negotiable at the boundary

| # | Rule |
|---|---|
| 1 | **`:idx` fields are US AQI, 0 to 500.** Never treat `air_quality_pm2p5:idx` as µg/m³. Thresholds live in AQI. |
| 2 | **Convert °C to °F in normalization**, never deeper. `env_params` is °C; `heat_intelligence` is °F. Assert both. |
| 3 | **`null` and legacy `-999` mean unavailable.** Propagate as missing. Never coerce to zero. |
| 4 | **De rate `clear_sky.dni` by `cloud_cover_octas`** before any tint decision. The vendor labels it clear sky; using it raw tints a west facade on an overcast day. |
| 5 | **Read `metadata.time_range.interval`** into `EnvSnapshot.intervalMin`. Do not hardcode a step. |
| 6 | **404 right after submission is normal.** Retry with backoff before failing. |
| 7 | **Compare status case insensitively** and accept `succeeded` and `error` alongside `Completed` and `Failed`. |

## Call plan

Six parameters are needed: `wet_bulb_temperature_celsius`, `apparent_temperature_celsius`,
`air_quality_pm2p5:idx`, `air_quality_o3:idx`, `cloud_cover_octas`, `solar_irradiance`.

| Tier | Calls | How |
|---|---|---|
| Premium | 1 | omit `analysis` entirely |
| Basic / Startup | 2 | 3 parameters each, split per [`api.md`](../../docs/reference/fortyguard/api.md) |

Use `filter_type: 2` to pull a whole span of hours as one task. A full replay day costs roughly
one heatmap plus one or two `env_params` tasks, not one call per hour.

## Constraints that shape the demo

- **United States only**, every plan.
- **Forecast horizon is now + 12 hours.** That is the hard ceiling on pre positioning.
- `granularity` is the number `60`, `80`, or `100`.
- Heatmap area: 10 mi² on Basic, 50 mi² on Premium.
- Credits are charged only on `Completed`, so failed experiments are free.
- Rate limits behind 429 are **undocumented** — capture once and replay, per
  [`determinism.md`](../../docs/decisions/platform/determinism.md).

## Corrected assumptions

Recorded so the same mistakes are not reintroduced. Each of these was believed before the docs arrived.

| Was assumed | Actually |
|---|---|
| PM2.5 in µg/m³, ozone in ppb | **Both are US AQI index values** |
| Temperatures in °F | **All °C** on `env_params` |
| Irradiance available per timestamp | **One clear sky object per location** |
| A vendor "persistence layer" for sustained triggers | `persistence` is a **heatmap analytic** for hours past a temperature threshold. Unrelated. Sustained logic is ours, in `core/src/utils/hysteresis.ts`. |
| 15 minute control grid | Undocumented; every `filter_type` is hour granular |
| Segmentation needed for facade context | It is Premium only, and facade azimuth is static building metadata anyway |
