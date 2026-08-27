# BOPTEST — working contract

Taken from the project's **own OpenAPI spec**, `service/web/server/docs/openapi.yaml` in
[ibpsa/project1-boptest](https://github.com/ibpsa/project1-boptest), read on 28 Aug 2026.
Not from a blog, not from memory. Live responses land in [`samples/`](samples/) as we capture them.

## Transport

| | |
|---|---|
| Local | `http://127.0.0.1:8000` after `docker compose up web worker provision` |
| Hosted | `https://api.boptest.net` — ⚠️ **unreachable from here.** TCP connects on 443, Client Hello goes out, then `SSL_ERROR_SYSCALL`. `-k` does not help, and HTTPS to github, pypi, and FortyGuard all succeed from the same machine. Treat as broken. |
| Envelope | Every `testid` call returns `{"status": int, "message": str, "payload": <data>}`. `200` ok, `400` bad input, `500` internal. |

## Lifecycle

```
GET  /testcases                          list archetypes
POST /testcases/{name}/select        →   testid
PUT  /scenario/{testid}                  time_period, electricity_price, uncertainty
PUT  /initialize/{testid}                start_time, warmup_period
GET  /inputs/{testid}                    control point names + metadata   ← point discovery
GET  /measurements/{testid}              sensor point names + metadata
PUT  /step/{testid}                      control interval, seconds
POST /advance/{testid}               →   measurements, one control step
GET  /kpi/{testid}                   →   independent scoring
GET  /results/{testid}                   full trajectories
```

## The write path

`POST /advance/{testid}` takes a **flat object**, two keys per overridden point:

```json
{ "<input_name>_u": 294.15, "<input_name>_activate": 1 }
```

`_activate: 1` enables the overwrite, `0` hands the point back to the emulator's own baseline
controller. This is the mechanism that lets us drive only the actuators we have earned, which maps
exactly onto the per actuator autonomy grants in
[`../../flows/product-flow.md`](../../flows/product-flow.md).

## KPIs — why the sandbox exists

`GET /kpi/{testid}` returns, computed by the emulator rather than by us:

| Key | Meaning |
|---|---|
| `ener_tot` | Total energy use |
| `cost_tot` | Total operational cost |
| `emis_tot` | Total emissions |
| `tdis_tot` | **Thermal discomfort** |
| `idis_tot` | **Indoor air quality discomfort** |
| `pele_tot` · `pgas_tot` · `pdih_tot` | Peak electrical, gas, district heating |
| `time_rat` | Computation time ratio |

Those first five are precisely the quantities our four policies trade against each other. `idis_tot`
scores the air quality override and `tdis_tot` scores the pre cool coast, **using physics we did not
write**.

## Stress testing is built in

`PUT /scenario/{testid}` accepts:

| Field | Values |
|---|---|
| `electricity_price` | `constant` · `dynamic` · `highly_dynamic` |
| `time_period` | test case specific, e.g. `peak_cool_day`, `typical_cool_day`, `mix_day` |
| `temperature_uncertainty` | `none` · `low` · `medium` · `high` |
| `solar_uncertainty` | `none` · `low` · `medium` · `high` |
| `seed` | int, for repeatability |

Forecast uncertainty is a first class input. That matters because **our whole thesis is forecast
driven**: if the copilot's advantage evaporates under `high` temperature uncertainty, that is a real
finding about the product, not a bug in the emulator.

Setting `time_period` may trigger a re initialization, and the payload then returns initial
measurements instead of an echo.

## Our archetype

`multizone_office_simple_air` — *"Multi-zone (5 zones) commercial building model based on U.S. DOE
medium office building with single-duct VAV with terminal reheat, air-cooled chiller, and
air-to-water heat pump."*

Chosen because it is a **commercial office on an air system with a cooling peak day**, which is our
use case. It is **not** the Manhattan tower in our fixtures, and we say so wherever a number from it
appears.

Scenarios available: `peak_heat_day`, `typical_heat_day`, `peak_cool_day`, `typical_cool_day`,
`mix_day`.

## Boundaries, restated

BOPTEST brings its own weather. **FortyGuard drives the decisions, BOPTEST drives the physics**, and
any divergence between the two is shown rather than reconciled. See
[`../../decisions/platform/sandbox.md`](../../decisions/platform/sandbox.md).
