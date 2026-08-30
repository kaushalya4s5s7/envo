# Deployment

Envo is deployed as one Next.js application. The browser renders the product; server-side route
handlers call external services and access secrets. The framework-free `core` package is bundled
into the web application and remains independently testable.

## Runtime surfaces

| Surface | Runtime | Purpose |
|---|---|---|
| `web` | Node.js | Next.js pages, authentication, persistence, live capture, and sandbox routes |
| `core` | Bun tooling; plain TypeScript | Contracts, policies, arbiter, twin, BMS adapters, and tests |
| `fixtures` | Committed files | Deterministic replay and offline demo input |
| BOPTEST | Local or configured HTTP service | Independent building physics and KPI scoring |

```text
Browser
  │
  ├── Next.js pages and client components
  │
  └── Next.js server routes
       ├── FortyGuard and geocoding calls
       ├── Postgres reads and writes
       ├── BOPTEST calls through BOPTEST_URL
       └── core decision and artifact generation
```

## Commands

```bash
bun install
bun run dev       # local web server on port 3000
bun run build     # production Next.js build
bun run start     # serve the production build
bun run check-types
bun test
```

The root `start` script runs `next start` from `web/`. Railway or another Node host should provide
the environment variables documented in [`.env.example`](../.env.example), run `bun install`, build
with `bun run build`, and start with `bun run start`.

## Environment boundaries

Required server-side variables include:

- `FORTYGUARD_API_KEY` and `FORTYGUARD_TIER` for live address capture;
- `DATABASE_URL` for organization, building, run, and report persistence;
- `AUTH_SECRET` for session signing.

Optional variables include Google OAuth credentials, `GOOGLE_GENAI_API_KEY`, and `BOPTEST_URL`.
`BOPTEST_URL` defaults to `http://127.0.0.1:8000`. No secret is named `NEXT_PUBLIC_*`, and no
provider key is passed to a client component.

## Local BOPTEST

The repository does not include or fork the BOPTEST emulator. Start the upstream service according
to [`docs/reference/boptest/api.md`](reference/boptest/api.md), then point Envo at it:

```bash
BOPTEST_URL=http://127.0.0.1:8000 bun run dev
```

The sandbox route checks availability first. If the emulator is unavailable, the product returns
the committed experiment instead of presenting a newly generated score as if it had been run.

## Deterministic demo versus live product

The judged replay is offline:

```text
committed fixture → core artifact builder → /replay
```

The address capture path is live and requires external services:

```text
address → geocoding → FortyGuard heatmap → FortyGuard parameters
        → core artifact builder → persisted run and /app?capture=<id>
```

This distinction is governed by [`decisions/platform/determinism.md`](decisions/platform/determinism.md).
The replay never depends on a live weather, database, Gemini, or BOPTEST request.

## Deliberate production boundaries

The current deployment is an advisory and simulation product:

- commands land in `SimulatedBms` or BOPTEST, never real equipment;
- there is no BACnet or Modbus adapter connected to a customer site;
- the digital twin's indoor CO₂, occupancy, temperature, and energy values are modeled;
- pressure, fire, and life-safety interlocks remain the responsibility of a real BMS;
- BOPTEST KPIs are benchmark evidence, not metered savings;
- FortyGuard coverage and resolution remain subject to the product claims in
  [`decisions/product/what-we-can-claim.md`](decisions/product/what-we-can-claim.md).

Adding a real BMS transport requires a separate adapter, site credentials, shadow validation, and
operator-approved autonomy grants. It must not be enabled by changing a browser-side setting.
