<p align="center">
  <img src="docs/assets/logo.svg" alt="Envo" width="88" />
</p>

<h1 align="center">Envo</h1>
<p align="center"><b>The outdoor brain for buildings that already have the controls but not the signal.</b></p>

<p align="center">
  <img src="https://img.shields.io/badge/Bun-workspaces-black?logo=bun&logoColor=white" alt="Bun" />
  <img src="https://img.shields.io/badge/Next.js-15-black?logo=next.js&logoColor=white" alt="Next.js 15" />
  <img src="https://img.shields.io/badge/TypeScript-strict-black?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind-v4-black?logo=tailwindcss&logoColor=white" alt="Tailwind v4" />
</p>

<p align="center">
  <a href="https://envo.up.railway.app"><b>Live demo</b></a> ·
  <a href="docs/idea.md">Full concept &amp; research</a> ·
  <a href="docs/architecture.md">Platform architecture</a> ·
  <a href="LICENSE">MIT License</a> ·
  <a href="#try-it-locally">Try locally</a> ·
  <a href="#fortyguard-api-usage">FortyGuard usage</a> ·
  <a href="#why-trust-the-numbers--the-boptest-sandbox">The sandbox</a>
</p>

---

Envo is a per-building agent. You give it an address. It reads the next twelve hours of block level
heat and sun, combines them with the available air quality signal, and turns the result into HVAC
setpoint, shade tint, outside air damper, and demand response commands.

> “When wildfire smoke crossed New York during the July 2026 heat wave, buildings faced a hard
> tradeoff: reduce outdoor air to protect occupants, or keep ventilation moving as temperatures
> climbed. Buildings have the controls. What they need is an outdoor brain that sees heat, smoke,
> and sun together—before it arrives. That’s what we built on FortyGuard.”
>
> — [NYC Emergency Management, July 15, 2026](https://www.nyc.gov/site/em/about/press-releases/20260715_pr-NYCEM-Smoke-From-Canadian-Wildfires-May-Affect-NYC-Air-Quality.page)

The full platform flow is documented in
[`docs/architecture.md`](docs/architecture.md): customer deployment, environmental data processing,
pure policies, arbitration, safety gates, simulated execution, and independent BOPTEST validation.

<p align="center">
  <a href="https://youtu.be/tsp1lsIyA_M?si=5QymeRy7jDz_59d8">
    <img src="https://img.youtube.com/vi/tsp1lsIyA_M/maxresdefault.jpg" alt="Watch the Envo demo" width="720" />
  </a>
  <br />
  <sub>
    <a href="https://youtu.be/tsp1lsIyA_M?si=5QymeRy7jDz_59d8">▶ Watch the demo video</a> ·
    <a href="https://envo.up.railway.app">Try the live demo</a>
  </sub>
</p>

---

## The problem

A building's automation system already knows how to hold a setpoint, tilt a shade, or adjust a
damper. What it does not have is foresight or a way to balance the conditions those controls
affect. A citywide weather feed hides the thermal difference between neighboring blocks, so the
system reacts after heat arrives or cools too early and wastes energy.

The outside air damper creates a second tradeoff. Opening it brings in needed ventilation, but it
can also bring ozone and particulate pollution inside. Closing it limits that pollution, but
indoor CO₂ rises. Temperature, sun, comfort, energy, ozone, particulates, and CO₂ are connected
through the same few physical controls.

Temperature is genuinely block level. Air quality is not: ozone changes hour to hour, while PM2.5
is a daily metro scale signal. Envo uses both signals honestly, adding a block level thermal
forecast and a decision layer that can arbitrate the tradeoff before the problem arrives.

## The solution

1. **You give it an address.** No hardware, no site visit, no access to your BMS.
2. **It reads the right signals.** A live [FortyGuard](#fortyguard-api-usage) heatmap finds the
   100 m thermal tile the building sits in. A twelve hour parameter forecast adds heat, sun, ozone,
   and particulate context for the decisions that follow.
3. **Three active pure policies decide.** Precooling, shade tint, and outside-air quality each
   propose commands from the forecast; an arbiter resolves conflicts between them. Demand response
   is defined as a supporting policy but is not active in the replay loop (see
   [`docs/decisions/product/arbitration.md`](docs/decisions/product/arbitration.md)).
4. **Commands land in a digital twin for instant preview, and are independently scored against
   BOPTEST** — a real physics-based building emulator, not our own model. See
   [why that matters](#why-trust-the-numbers--the-boptest-sandbox).
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

**Scored against a real physics emulator, not our own model.** Comparing identical actuators driven
by a hyperlocal forecast versus a degraded citywide-only signal:

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

## Why trust the numbers — the BOPTEST sandbox

There is no live connection to a real building's BMS. What we validate against instead is more
useful for proving the control logic actually works: **BOPTEST**, an independent, physics-based
building emulator built through IBPSA with U.S. Department of Energy and national lab
contributions — the same class of tool real building-science research uses to score control
algorithms, not something we wrote ourselves.

### Where BOPTEST comes from

Envo does **not** fork or own BOPTEST. We use the upstream open-source
[IBPSA Project 1 BOPTEST repository](https://github.com/ibpsa/project1-boptest) and its standard
HTTP API. BOPTEST development began under IBPSA Project 1 and continues under
[IBPSA Project 2](https://ibpsa.github.io/project1-boptest/ibpsa/), an international collaboration
under the [International Building Performance Simulation Association (IBPSA)](https://ibpsa.org/).

This is an open research benchmarking framework, not a regulatory certification or an authority
that approves Envo. Project 2 maintains the framework, emulators, API, and KPI definitions through
its collaborating institutions. The U.S. Department of Energy's
[Building Technologies Office overview](https://www.energy.gov/eere/buildings/boptest-building-operations-testing-framework)
identifies Lawrence Berkeley National Laboratory (LBNL) as the principal investigator; the official
project page lists David Blum (LBNL) and Lieve Helsen (KU Leuven) as Project 2 co-operating agents.

In this project, `BoptestClient` talks to a BOPTEST service configured through `BOPTEST_URL`
(default: `http://127.0.0.1:8000`). The local service is started from the upstream deployment with
`docker compose up web worker provision`; the public service is
[`api.boptest.net`](https://api.boptest.net). If the emulator is unavailable, the product serves
the committed experiment rather than pretending a new score was produced.

**Why not just trust our own twin?** `core/src/twin` is code we wrote — fast first-order thermal
lags, good for an instant in-product preview, but it can never disagree with us in an interesting
way. It already flattered us once: our twin reported 26.1% energy savings on a captured day;
BOPTEST, independently, reported **twice the energy use**. Chasing that gap down surfaced two real
bugs — the air-quality purge was watching the wrong pollutant, and the precool logic was holding
the zone three degrees colder than the building was designed for. That is the entire argument for
running a sandbox instead of grading our own homework. Full writeup:
[`sandbox-findings.md`](docs/decisions/platform/sandbox-findings.md).

**How it plugs in.** [`core/src/sandbox/index.ts`](core/src/sandbox/index.ts) runs the **identical**
`airQualityPolicy`, `precoolPolicy`, `tintPolicy`, and `arbitrate` functions the live product uses —
not a reimplementation for the benchmark. The only thing that changes is where the resulting
commands land:

| Target | Role |
|---|---|
| `SimulatedBms` | Instant, in-process — the live preview inside the product |
| BOPTEST, via [`BoptestClient`](core/src/bms/boptest/client.ts) | Independent scoring, real physics |

Against BOPTEST, commands go out as `POST /advance/{testid}` with `{"<point>_u": value,
"<point>_activate": 1}` for only the actuators Envo has earned control of that interval —
everything else is handed back to the emulator's own baseline controller with `_activate: 0`. That
partial-control handoff is the same mechanism a real BMS integration would need, tested end to end
against real building physics.

**It grades itself, not us.** `GET /kpi/{testid}` returns energy, cost, and both thermal and
air-quality discomfort, computed by the emulator's own physics — that is where the results table
above comes from, not a number we produced.

**The honest boundary.** BOPTEST supplies its own weather and a building archetype, not literally
the Manhattan tower on the pitch page. FortyGuard drives every decision; BOPTEST only answers what a
building does once you act on it. Where the two disagree, that is disclosed on screen, never
reconciled quietly. Full API contract: [`docs/reference/boptest/api.md`](docs/reference/boptest/api.md).

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

## Try it locally

### Prerequisites

- [Bun](https://bun.sh/) 1.3.6 or newer
- Node.js for the Next.js server runtime
- A FortyGuard API key only if you want to run a live address capture
- Postgres only if you want account, building, and run persistence

### Offline replay

The deterministic replay is the fastest way to see the product and does not require API keys,
Postgres, or a running BOPTEST emulator:

```bash
bun install
bun run dev
```

Open [http://localhost:3000/replay](http://localhost:3000/replay). It uses the committed fixture,
so the demo remains reproducible and offline.

### Live address capture

Copy the example environment file and fill in the required server-side values:

```bash
cp .env.example .env.local
# Set FORTYGUARD_API_KEY, FORTYGUARD_TIER, DATABASE_URL, and AUTH_SECRET in .env.local.
bun run dev
```

Open [http://localhost:3000/onboarding](http://localhost:3000/onboarding), sign in, and enter a
U.S. address. The capture makes live geocoding and FortyGuard requests, then renders the resulting
artifact at `/app?capture=<id>`. Never commit or paste `.env.local` into the browser.

### Optional BOPTEST sandbox

The sandbox page can use the committed experiment when BOPTEST is unavailable. To run a fresh
independent experiment, start the upstream BOPTEST service and configure its URL:

```bash
BOPTEST_URL=http://127.0.0.1:8000 bun run dev
```

See [the BOPTEST deployment contract](docs/reference/boptest/api.md) for the upstream Docker
command and service details.

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
| `BOPTEST_URL` | No | BOPTEST service URL; defaults to `http://127.0.0.1:8000` |
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
          bms/                  SimulatedBms (live preview) + a BOPTEST HTTP client
          copilot/              the control loop and conflict arbiter
          sandbox/              runs the same policies against BOPTEST for independent scoring
web/      Next.js 15 — the pitch at /, the app at /app, the replay viewer at /replay
fixtures/ captured days, committed, deterministic — what /replay always shows
docs/     product law lives in docs/decisions/ — read before changing a threshold
```

`core` imports nothing from `web`. Deleting `web/` entirely still leaves `core` and its tests
working — that boundary is what lets the agent's logic be tested without a browser or a server.

## Honest limitations

Volunteered up front, not buried: there is no live connection to a real building's BMS yet — every
command lands in a digital twin and is independently scored against BOPTEST (see
[above](#why-trust-the-numbers--the-boptest-sandbox)), never a real building. CO₂ and occupancy are
modeled, not measured. Energy figures are modeled, not metered. Coverage is US-only at 60–100 m
resolution. Thresholds are starting values, not tuned per building yet. There is no pressure,
life-safety, or fire-mode handling — a real deployment sits behind a real BMS's own interlocks for
that. Full list:
[`docs/decisions/product/honesty-rails.md`](docs/decisions/product/honesty-rails.md).

## Where to read more

| Doc | Read it for |
|---|---|
| [`docs/idea.md`](docs/idea.md) | The full concept, the research, every objection and its answer |
| [`docs/decisions/product/what-we-can-claim.md`](docs/decisions/product/what-we-can-claim.md) | Exactly what is proven versus what is not |
| [`docs/decisions/platform/sandbox-findings.md`](docs/decisions/platform/sandbox-findings.md) | The full BOPTEST scoring writeup, including where Envo currently loses |
| [`docs/reference/boptest/api.md`](docs/reference/boptest/api.md) | The BOPTEST API contract this project actually calls |
| [`docs/architecture.md`](docs/architecture.md) | End-to-end platform flow, code boundaries, and simulation layers |
| [`docs/decisions/product/arbitration.md`](docs/decisions/product/arbitration.md) | How policy proposals resolve conflicts |
| [`LICENSE`](LICENSE) · [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) | Source-code license and external asset/service notices |
