# Envo

**The outdoor brain for buildings that already have the controls but not the signal.**

Envo is a per-building agent. You give it an address. It reads the next twelve hours of heat, sun,
and air quality for that building's own city block — not the metro average — and turns that into
HVAC setpoint, shade tint, outside air damper, and demand response commands. It emits those
commands into a **simulated** building automation system (a digital twin), so you can watch the
decisions and their consequences before any of this touches a real building.

**Live demo:** https://envo.up.railway.app
**Full concept, research, and objections handled:** [`idea.md`](idea.md)

---

## The problem

A building's automation system already knows how to hold a setpoint, tilt a shade, or close a
damper. What it does not have is foresight, or a thermal picture of its own block. It reacts to
what a rooftop sensor feels right now, using a weather feed built for a whole city, not one
address. By the time it notices the building is hot, it is already hot.

## The solution

1. **You give it an address.** No hardware, no site visit, no access to your BMS.
2. **It reads that block specifically.** A live [FortyGuard](#fortyguard-api-usage) heatmap finds
   the 100 m tile the building sits in and pulls a twelve hour forecast for that exact point.
3. **Four pure policies decide.** Precool, shade tint, outside air damper, and air quality each
   propose commands from the forecast; an arbiter resolves conflicts between them (see
   [`docs/decisions/product/arbitration.md`](docs/decisions/product/arbitration.md)).
4. **Commands go to a simulated BMS**, not a real one. A digital twin models zone temperature,
   thermal mass, indoor CO₂, and cooling energy so the consequence of each decision is visible.
5. **Every decision carries a rationale, a trigger, and an undo condition.** Nothing is a black
   box — see it live at `/app` after signing in, or replay a captured day at `/replay`.

## What we can honestly say it does

Every number below traces to a real capture or a real emulator run — see
[`docs/decisions/product/what-we-can-claim.md`](docs/decisions/product/what-we-can-claim.md) and
[`docs/decisions/platform/sandbox-findings.md`](docs/decisions/platform/sandbox-findings.md) for
the full method. Nothing here is typed by hand or modeled-only unless labeled that way.

**Temperature genuinely varies block to block.** A single FortyGuard heatmap probe returned 4,265
distinct 100 m tiles spanning **2.8 °F** between the hottest and coolest block, in the same minute,
across 23 mi². A citywide weather feed collapses that into one number.

**Scored against a real physics emulator, not our own model.** We ran Envo's control loop against
[BOPTEST](docs/reference/boptest/api.md)'s independent building simulator, comparing identical
actuators driven by a hyperlocal forecast versus a degraded citywide-only signal:

| | Hyperlocal signal vs. citywide signal, same actuators |
|---|---|
| Cooling energy | **5.1% less** |
| Air quality discomfort | **17.8% less** |
| Cost | 2.3% more |
| Peak electrical | 10.3% more |

Against BOPTEST's own tuned built-in controller (a much higher bar), Envo still uses more energy
today — that gap and its root cause are written up honestly in
[`sandbox-findings.md`](docs/decisions/platform/sandbox-findings.md) rather than hidden.

**What we learned live testing does not hold:** air quality (PM2.5, ozone) turned out to be
**metro-scale**, not hyperlocal — two points 15 km apart returned an identical reading. The product
claim narrowed from "hyperlocal everything" to hyperlocal **heat** plus an agent that arbitrates
air quality against energy, which nobody automates today either way.

**Modeled, not measured.** kWh figures come from the digital twin, not a utility meter. Every
modeled number shown to a user states that inline, on screen — see
[`docs/decisions/product/honesty-rails.md`](docs/decisions/product/honesty-rails.md).

---

## FortyGuard API usage

FortyGuard is the only source of environmental data in this project, and it lives behind one
boundary: [`core/src/weather/fortyguard/`](core/src/weather/fortyguard/). Nothing else in the
codebase knows the vendor exists. Every call below is real — triggered live from
[`web/app/api/capture/route.ts`](web/app/api/capture/route.ts) whenever someone captures a
building, not a fixture.

Both endpoints are **asynchronous**: a `POST` returns an `activity_id`, and the client polls
`GET /v1/status/{activity_id}` until the job finishes. Implementation:
[`client.ts`](core/src/weather/fortyguard/client.ts).

| Call | What it does | Why we need it | What it drives |
|---|---|---|---|
| `POST /v1/heatmap` (`analytic_type: tcm`, granularity 60–100 m) | Returns a grid of thermal tiles across an area | Finds this **specific building's tile temperature**, not a metro average — the whole thesis depends on this being per block | Feeds the precool policy's trigger and the live heatmap shown on the site |
| `POST /v1/env_params` (lat, lon, that tile's temperature) | Returns current conditions plus a **12 hour forecast** for six parameters | Nothing is reactive-only: the agent can act *before* the peak, not after | Feeds all four policies — see below |

The six parameters we read (verified against [`core/src/contracts`](core/src/contracts)) and where
each one lands:

| Parameter | Feeds |
|---|---|
| Apparent temperature (°F) | Precool policy — when to start cooling early |
| Wet-bulb temperature (°F) | Comfort ceiling, human-perceived heat |
| Ozone AQI, PM2.5 AQI | Air quality policy — when to seal the outside air intake |
| Cloud cover (%) | De-rates raw clear-sky solar irradiance before any tint decision — skipping this would tint a west façade on an overcast day |
| DNI / DHI (W/m², direct + diffuse solar) | Tint policy — which façade the sun is actually on |

A key on the Premium tier returns all six parameters in one `env_params` call; a Basic key would
need two calls to cover the same set. See `FORTYGUARD_TIER` in [`.env.example`](.env.example).

---

## Quick start

```bash
bun install
cp .env.example .env.local   # fill in FORTYGUARD_API_KEY and DATABASE_URL at minimum
bun run dev                  # web on :3000
```

| Command | Does |
|---|---|
| `bun run dev` | Starts the web app |
| `bun run build` | Production build |
| `bun run check-types` | Type-checks every workspace — run after every change |
| `bun test` | Runs `core`'s test suite (pure policies, no I/O, no server) |

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `FORTYGUARD_API_KEY` | Yes | Live capture will not work without it |
| `FORTYGUARD_TIER` | Yes | `BASIC` or `PREMIUM` — changes the call plan above |
| `DATABASE_URL` | Yes | Postgres. Accounts, buildings, and reports are stored here |
| `AUTH_SECRET` | Yes | Session signing, required by NextAuth |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | No | Enables real Google sign-in. Without them, sign-in falls back to a clearly labeled demo mode that accepts any email and verifies nothing — never both at once |
| `GOOGLE_GENAI_API_KEY` | No | Powers the rationale text behind each decision |

---

## Project structure

```
core/     the agent — framework-free TypeScript, no imports from web
          weather/fortyguard/   the only place the vendor name appears
          policies/             precool · tint · airQuality — pure functions, no I/O
          twin/                 the digital twin: temperature, mass, CO₂, cooling energy
          bms/                  simulated building automation system
          copilot/              the control loop and conflict arbiter
web/      Next.js 15 — the pitch at /, the app at /app, the replay viewer at /replay
fixtures/ captured days, committed, deterministic — what /replay always shows
docs/     product law lives in docs/decisions/ — read before changing a threshold
```

`core` imports nothing from `web`. Deleting `web/` entirely still leaves `core` and its tests
working — that boundary is what lets the agent's logic be tested without a browser or a server.

## Honest limitations

Volunteered up front, not buried: the actuator is **simulated**, not a real BMS connection. CO₂ and
occupancy are modeled, not measured. Energy figures are modeled, not metered. Coverage is US-only
at 60–100 m resolution. Thresholds are starting values, not tuned per building yet. There is no
pressure, life-safety, or fire-mode handling — a real deployment sits behind a real BMS's own
interlocks for that. Full list:
[`docs/decisions/product/honesty-rails.md`](docs/decisions/product/honesty-rails.md).

## Where to read more

| Doc | Read it for |
|---|---|
| [`idea.md`](idea.md) | The full concept, the research, every objection and its answer |
| [`docs/decisions/product/what-we-can-claim.md`](docs/decisions/product/what-we-can-claim.md) | Exactly what is proven versus what is not |
| [`docs/decisions/platform/sandbox-findings.md`](docs/decisions/platform/sandbox-findings.md) | The full BOPTEST scoring writeup, including where Envo currently loses |
| [`docs/architecture.md`](docs/architecture.md) | Repo shape and the principles worth keeping |
| [`docs/decisions/product/arbitration.md`](docs/decisions/product/arbitration.md) | How the four policies resolve conflicts |
