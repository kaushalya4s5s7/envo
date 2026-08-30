# Envo platform architecture

This document describes how the platform works end to end. The repository tree is only one part of
it. The diagrams in `docs/assets/` are visual summaries; the implementation and honesty boundaries
below are authoritative.

## The platform in one sentence

Envo takes an address, obtains a block level thermal signal plus the available air quality and
solar forecast, turns those inputs into policy proposals, resolves their conflicts, passes the
result through safety gates, and shows or simulates the building response before any real control is
considered.

The central boundary is:

```text
FortyGuard drives Envo's decisions.
BOPTEST or the digital twin drives the simulated building physics.
Neither is presented as a real BMS connection.
```

## End to end architecture

```text
User
  │ address, floor area, approvals
  ▼
Web application
  │ live capture or committed replay
  ▼
Environmental data boundary
  │ FortyGuard heatmap + environmental parameters
  ▼
Normalization boundary
  │ EnvSnapshot: now, forecast, solar, air quality, timebase
  ▼
Envo core decision layer
  │ policies → proposals → arbiter → DecisionRecords
  ▼
Safety and command boundary
  │ hysteresis, persistence, comfort limits, rate limits, autonomy gate
  ▼
BMS adapter
  ├── SimulatedBms → digital twin → modeled building response
  └── BoptestAdapter → BOPTEST physics → independent KPIs
                                      │
                                      ▼
                         replay artifact, brief, logs, scorecard
```

![Envo platform architecture](assets/Envo%20Architecture%20Flow%20Diagram%20-%20visual%20selection-3.png)

## 1. Customer deployment flow

The customer path is deliberately staged. Each step gives the operator evidence before asking for
more access.

```text
Address and advisory
        ↓
Discover building controls
        ↓
Human confirms point mappings
        ↓
Watch the simulated building run
        ↓
Shadow mode against the real building
        ↓
Grant autonomy one actuator at a time
        ↓
Daily morning brief and decision log
```

| Stage | Product surface | What happens | Current boundary |
|---|---|---|---|
| Address and advisory | `/onboarding` | Geocode an address, find its heatmap tile, pull the environmental data, and build a plan. | Live FortyGuard capture; building properties are partly assumed and shown. |
| Discover controls | `/app/connect` | Discover points, rank candidates, show the building's descriptions, and require a human confirmation. | Discovery uses a BOPTEST HTTP building; real BACnet or Modbus transport is not connected. |
| Watch it run | `/app/building` | Play the day and observe zones, setpoints, outside air, CO₂, and commands. | Values come from the BOPTEST reference model. |
| Prove it | `/app/sandbox` and `/replay` | Run or replay the same policies and compare the controllers. | `/replay` is deterministic; BOPTEST is an independent emulator. |
| Grant control | `/app/autonomy` | Choose `off`, `advisory`, `shadow`, or `autonomous` separately for each actuator. | The gate is implemented; no command reaches real equipment. |
| Daily operation | `/app` and `/app/decisions` | Show what will happen, what to do, why it fired, and when it reverses. | Indoor temperature, CO₂, and energy remain modeled until a real shadow connection exists. |

![Customer deployment funnel](assets/Envo%20Architecture%20Flow%20Diagram%20-%20visual%20selection-4.png)

The autonomy gate is intentionally not a single switch:

```text
off          → no command is considered
advisory    → propose and display, never send
shadow       → compare against the real building, never send
autonomous  → send only inside the configured guardrails
```

## 2. Building data processing

The first data path starts outside the building.

```text
User address and floor area
        ↓
Geocoding
        ↓
FortyGuard heatmap request
        ↓
Select the tile covering the building
        ↓
FortyGuard environmental parameter request
        ↓
Normalize units, timestamps, missing values, and forecast horizon
        ↓
EnvSnapshot
```

The live capture route in `web/app/api/capture/route.ts` performs this sequence:

1. It accepts the selected address and floor area.
2. It geocodes the address when coordinates were not already selected.
3. It requests the thermal map and binds the building to the tile covering its coordinates.
4. It requests the current and future environmental parameters for that location.
5. `core/src/weather/normalize.ts` converts the response into the framework-free `EnvSnapshot`
   contract.
6. `core/src/copilot/artifact.ts` runs the decision loop and returns the artifact used by the UI.
7. The capture and run are persisted for the signed-in organization when the database is available.

![Building data processing funnel](assets/Envo%20Architecture%20Flow%20Diagram%20-%20visual%20selection.png)

### What the environmental source provides

FortyGuard provides the outdoor signal:

- the heatmap provides genuinely block-level temperature;
- environmental parameters provide current values and an available forecast window;
- apparent temperature informs precooling;
- solar radiation and cloud cover inform façade tint;
- ozone and PM2.5 inform the outside-air policy;
- wet-bulb temperature provides additional thermal context.

The claims are intentionally narrower than “hyperlocal everything”:

- temperature and solar exposure support the block-level story;
- air quality is metro-scale;
- PM2.5 is a daily signal;
- ozone varies hour to hour;
- indoor CO₂ and energy are not supplied by FortyGuard and are modeled by the twin.

## 3. Envo decision making

Each `EnvSnapshot` enters the same deterministic loop. Policies never perform I/O, actuate, or
resolve conflicts. They only return proposals.

```text
EnvSnapshot + building state
        ↓
Precooling policy       → setpoint proposal
Façade tint policy      → tint proposal
Air quality policy      → outside-air proposal
Demand response policy  → load-shift proposal, when enabled
        ↓
Proposal collection
        ↓
Arbiter
        ↓
DecisionRecord + Command
```

![Envo core decision-making process](assets/Envo%20Architecture%20Flow%20Diagram%20-%20visual%20selection-2.png)

### What each policy does

| Policy | Signal it uses | Decision |
|---|---|---|
| Precooling | Future apparent temperature and the building's nominal setpoint | Charge thermal mass before a forecast peak, then coast through the peak. |
| Façade tint | Solar position, clear-sky radiation, façade azimuth, and cloud cover | Tint the exposed façade only when solar load justifies it. |
| Air quality | Current ozone and PM2.5, modeled indoor CO₂, and a future cleaner window | Reduce outside air during an outdoor pollution event and schedule a purge when CO₂ requires it. |
| Demand response | Portfolio forecast load and comfort constraints | Shift load away from an expensive or constrained period when enabled. |

The active `runReplay` loop currently invokes air quality, precooling, and tint. Demand response is
part of the platform model and policy contract, but is not currently invoked by that loop.

### Arbiter priority

When proposals conflict, the arbiter uses this fixed order:

```text
1. Occupant health: smoke and ozone
2. Occupant health: CO₂ purge
3. Comfort bounds
4. Energy and money optimization
```

Examples:

- hot and smoky → protect occupants first, then record the energy cost;
- smoky and stuffy → hold the intake reduced, then use the forecast to choose the least-bad purge;
- strong solar beam and a dark interior → stop tinting when the daylight tradeoff is no longer useful;
- demand response and a heat spike → shed load only inside the comfort bounds.

Every accepted command carries a populated `DecisionRecord` containing the trigger, threshold,
sustained count, rationale, conflicts overridden, and reversal condition.

### The agent layer

The deterministic policy and safety path is the source of truth. The optional model-backed agent in
`core/src/agent` sits beside it:

```text
Policy proposals + EnvSnapshot + indoor state
        ↓
Provider-agnostic arbitration prompt
        ↓
Gemini provider (build-time enrichment only)
        ↓
Structured command + rationale
        ↓
Zod contract → comfort/health/rate guards
        ↓
Accepted command or visible rejection
```

The model may choose among proposals and explain the tradeoff; it may not invent physics or bypass
the rails. `guardProposal` validates its output, enforces comfort and health priority, and rejects
malformed or rate-limited commands. A malformed model response is therefore treated as rejected
data, not as a reason to weaken the control path.

The agent is not called during the deterministic replay demo. Gemini can enrich an artifact at build
time with operator-facing prose, while `/replay` reads the committed artifact offline. Removing the
model must leave the core policy, arbiter, command, and verification path usable.

## 4. Command execution and verification

The decision layer does not directly know whether it is driving a simulator or a real building.
`core/src/bms` defines the `BmsAdapter` boundary.

```text
Command
  ↓
Autonomy gate
  ↓
Actuator rate limit
  ↓
BmsAdapter.apply()
  ↓
Observed adapter state
  ↓
Verify intent against observed state
  ↓
Twin or external physics step
```

![Command execution process](assets/Envo%20Architecture%20Flow%20Diagram%20-%20visual%20selection-3.png)

The current adapters are:

```text
BmsAdapter
├── SimulatedBms   in-process, used for the fast preview
├── BoptestAdapter HTTP adapter for independent sandbox scoring
└── BacnetAdapter  not built; the planned real-building transport
```

`SimulatedBms` applies setpoint, outside air, façade tint, and demand response commands in memory.
The adapter returns the state it actually holds. `verify` compares that state with the intended
command so the product distinguishes “we requested motion” from “the actuator moved”.

The real deployment boundary is explicit: Envo would emit a desired outside-air fraction, while a
real BMS would still enforce its own pressure, fire, and life-safety interlocks. Those interlocks
are not implemented here.

## 5. Digital twin and modeled building response

After actuation, `core/src/twin` steps the simulated building. It is a deliberately small model
whose purpose is to make consequences visible:

```text
Outdoor temperature + outside air
        ↓
Thermal load and plant capacity
        ↓
Zone temperature + thermal mass

Outside air + filtration
        ↓
Indoor particulate concentration

Occupants + ventilation
        ↓
Indoor CO₂ estimate

Cooling load
        ↓
Modeled energy
```

The twin uses first-order lags for temperature, thermal mass, particulates, and CO₂. Its values are
modeled, not measured. The same `RunArtifact` stores the environmental input, commands, decisions,
twin state, and verification result for each interval.

## 6. BOPTEST independent validation

BOPTEST is a separate validation branch, not another weather source for Envo.

```text
Independent validation branch
        ↓
Envo policies and arbiter produce commands
        ↓
BOPTEST physics model applies the commands
        ↓
BOPTEST returns measurements and independent KPIs
        ↓
Compare three arms
```

![BOPTEST sandbox validation process](assets/Envo%20Architecture%20Flow%20Diagram%20-%20visual%20selection-5.png)

The three arms use the same building archetype, same day, and same control interface:

- **BOPTEST built-in controller** — the only controller Envo did not write;
- **Citywide signal baseline** — Envo's actuators and policies with current conditions and a
  degraded citywide signal, without the useful forecast;
- **Envo** — the same actuators and policies with the captured FortyGuard thermal forecast.

Only the signal changes between the two Envo-controlled arms. BOPTEST supplies the building physics
and computes energy, cost, thermal discomfort, and air-quality discomfort. It does not consume
FortyGuard as ground truth, and its reference building is not the Manhattan building from the
landing page.

This separation is the reason the sandbox is credible:

```text
FortyGuard → what Envo decides from
BOPTEST    → what happens when the command is applied
```

## 7. Replay, live capture, and persistence

There are two data modes with the same artifact shape:

```text
Live address capture
  FortyGuard + geocoding → buildArtifact → database and /app?capture=...

Committed replay
  fixtures → buildArtifact → web/lib/artifact.json → /replay
```

`/replay` is deterministic and does not make live vendor or model calls during the demonstration.
`/onboarding` is the product path that captures the address entered by a user and requires the
configured live services. A live capture is stored in the database for the signed-in organization;
an in-flight job is also held in memory while the asynchronous vendor tasks complete.

The web layer renders artifacts. It does not recompute policy decisions in React components.

## 8. Code boundaries

```text
web
  ├── routes, authentication, persistence, API transport, and rendering
  └── imports core; never owns thresholds, policy logic, or physics

core
  ├── contracts
  ├── weather and vendor adapter boundary
  ├── building metadata
  ├── policies
  ├── arbiter and control loop
  ├── BMS adapters
  ├── digital twin
  └── sandbox integration

fixtures
  └── committed captured data for deterministic replay and tests
```

The dependency direction is one way:

```text
web → core
core → no web, no React, no Next.js
policies → contracts and primitives, never copilot
twin → contracts and primitives, never policies
```

Capability names hide swappable vendors. FortyGuard appears only inside
`core/src/weather/fortyguard/`; the rest of the system uses the normalized weather contract.
Similarly, callers use `BmsAdapter` rather than knowing whether the target is the simulated BMS or
BOPTEST.

## 9. Platform surfaces

| Surface | Responsibility |
|---|---|
| `/` | Product problem, block-level heat evidence, and one decision example. |
| `/replay` | Deterministic captured day, Copilot versus citywide baseline, and agent panel. |
| `/onboarding` | Address, live heatmap capture, forecast, and first advisory artifact. |
| `/app` | One morning brief for the selected building. |
| `/app/decisions` | Full rationale, trigger, and reversal audit log. |
| `/app/connect` | Point discovery and human-confirmed mappings. |
| `/app/building` | Simulated zones, actuator state, and command playback. |
| `/app/sandbox` | BOPTEST run and independent scorecard. |
| `/app/autonomy` | Per-actuator permission gate. |
| `/dashboard`, `/app/reports`, `/app/team` | Organization, saved buildings, modeled rollups, and membership surfaces. |

## 10. Non-negotiable boundaries

- No live API calls are required by the deterministic replay demo.
- Temperature is block-level; air quality is metro-scale; PM2.5 is daily.
- CO₂, occupancy, zone temperature, and energy are modeled unless a real shadow connection supplies
  measurements.
- Every threshold comes from `docs/decisions/product/thresholds.md` and uses hysteresis where
  applicable.
- Every command has a rationale and a reversal condition.
- Policies remain pure and never actuate.
- The current product emits commands into simulation; it does not control a real building.
- BOPTEST is an independent scorer and building emulator, not proof of metered savings.

The architecture is successful if the weather provider, BMS transport, or presentation surface can
change without rewriting the policies, arbiter, contracts, or control loop.
