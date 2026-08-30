# General

**Product:** Envo — the outdoor brain for buildings that already have the controls but not the signal.

Per-building agent that fuses block-level thermal and solar forecasts with the available metro-scale
air-quality signal (wet bulb, apparent temp, ozone, PM2.5, DNI/DHI, cloud cover) into HVAC setpoint,
shade tint, outside-air damper, and demand-response proposals. Emits commands into a **simulated**
BMS (digital twin). Full concept and research: [`idea.md`](idea.md).

**Deliverable:** a replay run plus a split screen console proving Envo beats a citywide weather baseline controller on one hot, smoky afternoon.

## Stack

| Concern | Choice | Why |
|---|---|---|
| Package manager | **Bun** + workspaces + `catalog:` | Repo standard. Never npm/yarn. |
| Task runner | **Turborepo** | `turbo run check-types` after every change |
| Language | **TypeScript**, strict | — |
| **UI** | **Next.js 15, App Router** | `web` — the pitch and the replay viewer in one app |
| Styling | **Tailwind v4** + design tokens | The design system is expressed in Tailwind scale values, so use the real thing |
| Fonts | **`next/font/google`** — Geist, Geist Mono | Self hosted at build time. No CDN, no layout shift, no CSP problem |
| **Server/API** | **Next.js 15 Route Handlers** | `web/app/api` — capture, geocoding, points, and sandbox routes |
| Server runtime | **Node.js** | Next.js server routes and BOPTEST client run on Node |
| Contracts | **Zod** in `core/contracts` | One schema, shared by Nest pipes and React |
| Env | **`.env.local`** + server-side reads | Gitignored; `.env.example` documents required variables |
| Secrets | Server-side environment variables | Never expose keys through `NEXT_PUBLIC_*` or client components |
| Charts | **uPlot** plus hand rolled SVG and Canvas | Dense time series and the segment map |
| Lint, format | **oxlint + oxfmt** | Repo standard |
| Tests | **bun test** for `core`, **Jest + Supertest** for `api` | Nest's testing utilities expect Jest |

### Runtime note — Bun for tooling, Node for the web server

Bun is the package manager and the test runner for `core`. The Next.js web application runs on
Node.js in production because its server routes perform live capture, persistence, and BOPTEST
HTTP calls.

## Not in scope

No real BMS integration, pressure or life-safety handling, metered energy, or measured indoor
CO₂. Postgres persistence and authentication are present for the current organization/building
workflow. See [`deployment.md`](deployment.md) for the runtime and deliberate omission list.
