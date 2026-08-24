# Decision — The sandbox

**Status:** planned, not built · **Platform law once built.**

We validate and demonstrate control against **BOPTEST**, the IBPSA building optimization testing
framework, rather than only against our own digital twin.

## Why

Our `SimulatedBms` and `core/src/twin` are code we wrote. They cannot disagree with us in an
interesting way, and a judge or a buyer is right to discount a number produced by the same team that
produced the controller. BOPTEST is an independent, physics based emulator with its own KPI
calculation, developed through IBPSA with US Department of Energy and national lab contributions.

| | Our twin | BOPTEST |
|---|---|---|
| Physics | First order lags we wrote | Modelica, FMI, published and peer reviewed |
| KPIs | Self reported | `GET /kpi` — energy, thermal discomfort, cost, computed by the emulator |
| Purpose | Fast preview inside the product | **Validation and proof** |
| Cost | Free | Free, open source |

Keeping both is deliberate. The twin stays because it is instant and runs in the browser path; the
sandbox is what we point at when someone asks whether the numbers are real.

## What it gives us

| Endpoint | Use |
|---|---|
| `PUT /initialize/{id}` | Start the emulator at a time, with a warmup period |
| `PUT /forecast/{id}` | Boundary conditions ahead: weather, schedules, **prices** |
| `POST /advance/{id}` | **Send control inputs, receive measurements.** This is the write path. |
| `GET /inputs/{id}` · `GET /measurements/{id}` | Point names and metadata — point discovery, simulated |
| `GET /kpi/{id}` | Independent energy, discomfort, and cost scoring |
| `PUT /scenario/{id}` | Swap pricing and weather scenarios |

Endpoint list taken from the project README. **Not yet exercised by us** — see verification below.

## The BACnet path

[`epaulson/boptest-bacnet-proxy`](https://github.com/epaulson/boptest-bacnet-proxy) exposes a BOPTEST
emulator as BACnet/IP devices. That makes the protocol a real building actually speaks testable end
to end: discover points, map them, write setpoints — with no hardware and no customer site.

This is what makes Phase 3 of [`../../flows/product-flow.md`](../../flows/product-flow.md)
developable at all.

## Verification status — read before relying on this

| Claim | Status |
|---|---|
| Docker available locally | ✅ Verified: Docker 28.2.2, Compose v2.37.1 |
| `docker compose up web worker provision` starts it | ⬜ Not yet run |
| Hosted service at `api.boptest.net` | ⚠️ **Unverified.** The domain resolves and nginx answers over HTTP, `/` serves a web app, but the **TLS handshake fails from our environment** (curl error 35). Could be their certificate, could be our network. Do not plan around the hosted service until someone completes a request against it. |
| Endpoint shapes above | ⚠️ From the project README, not from a response we have seen |

**Plan for local Docker.** Treat the hosted service as a convenience if it turns out to work.

## Boundaries

- **BOPTEST supplies its own weather.** It is a closed physics world with its own boundary
  conditions. FortyGuard is hyperlocal and real. These do not merge cleanly, so:

  > **FortyGuard drives the decisions. BOPTEST drives the physics.**

  The agent reasons over the real outdoor signal for this block; the emulator answers what a building
  does when you act on it. Where BOPTEST's own weather contradicts FortyGuard, that divergence is
  **disclosed on screen**, never silently reconciled.

- **BOPTEST test cases are building archetypes**, not our Manhattan tower. We pick the closest
  archetype and say which one. We do not claim it is the demo building.

- The sandbox does **not** replace the honesty rails. A BOPTEST result is still a simulation, and
  [`../product/honesty-rails.md`](../product/honesty-rails.md) still forbids presenting it as metered.

## Architectural fit

`core/src/bms` already exports a `BmsAdapter` interface with the simulated implementation behind it,
bound by symbol token. The sandbox arrives as **one new implementation**:

```
BmsAdapter
├── SimulatedBms     in process, instant, used for preview        (built)
├── BoptestAdapter   HTTP to the emulator, independent KPIs        (M6)
└── BacnetAdapter    real protocol, via the proxy then real gear   (M8)
```

Policies, arbiter, and the control loop do not change. That was the point of the interface.
