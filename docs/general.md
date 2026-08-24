# General

**Product:** Envelope Copilot — the outdoor brain for buildings that already have the controls but not the signal.

Per-building agent that fuses hyperlocal forecast environmental data (wet bulb, apparent temp, ozone, PM2.5, DNI/DHI, cloud cover) at 60 to 100 m into HVAC setpoint, shade tint, outside air damper, and demand response commands. Emits commands into a **simulated** BMS (digital twin). Full concept: [`../idea.md`](../idea.md).

**Deliverable:** a replay run plus a split screen console proving Envelope Copilot beats a citywide weather baseline controller on one hot, smoky afternoon.

## Stack

| Concern | Choice | Why |
|---|---|---|
| Package manager | **Bun** + workspaces + `catalog:` | Repo standard. Never npm/yarn. |
| Task runner | **Turborepo** | `turbo run check-types` after every change |
| Language | **TypeScript**, strict | — |
| **UI** | **Next.js 15, App Router** | `web` — the pitch and the replay viewer in one app |
| Styling | **Tailwind v4** + design tokens | The design system is expressed in Tailwind scale values, so use the real thing |
| Fonts | **`next/font/google`** — Geist, Geist Mono | Self hosted at build time. No CDN, no layout shift, no CSP problem |
| **API** | **NestJS 11** | `api` — capture and the replay engine, when it earns its place |
| API runtime | **Node 24** | See the runtime note below |
| Contracts | **Zod** in `core/contracts` | One schema, shared by Nest pipes and React |
| Env | **t3-env** + zod | Loaded into Nest `ConfigModule` at boot |
| Secrets | `.env.local`, gitignored | **Deviation:** no Infisical. One key, no team, 3 days. |
| Charts | **uPlot** plus hand rolled SVG and Canvas | Dense time series and the segment map |
| Lint, format | **oxlint + oxfmt** | Repo standard |
| Tests | **bun test** for `core`, **Jest + Supertest** for `api` | Nest's testing utilities expect Jest |

### Runtime note — Bun for tooling, Node for Nest

Bun is the package manager and the test runner for `core`. **`api` runs on Node**, because NestJS leans on `reflect-metadata` and `emitDecoratorMetadata`, and the Nest CLI build path is only fully supported there. Mixing them is normal: one lockfile, one catalog, two runtimes.

## Not in scope

No database, no Redis, no auth, no payments, no multi tenancy, no real BMS integration. See [`deployment.md`](deployment.md) for the full omission list and the trigger that would add each back.
