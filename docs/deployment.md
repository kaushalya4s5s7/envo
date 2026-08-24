# Deployment

| Surface | Framework | Runtime | Command |
|---|---|---|---|
| `web` | Next.js 15 | Node | `bun run dev` · `bun run build` |
| `api` | NestJS 11 | **Node** (see below) | not built yet |
| Fixtures | — | — | `POST /capture/:scenario` (requires a live key), writes `fixtures/` |

Demo runs **offline from committed fixtures**. See [`decisions/platform/determinism.md`](decisions/platform/determinism.md).

## Why the API runs on Node

Bun is the package manager, workspace host, and test runner for the framework agnostic packages. NestJS runs on Node because it depends on `reflect-metadata` and `emitDecoratorMetadata`, and the Nest CLI build path is only fully supported there. One lockfile, one catalog, two runtimes. Do not try to move `api` onto the Bun runtime during the hackathon.

## Local ports

| App | Port |
|---|---|
| `web` | 3000 |
| `api` | 3333 |

`web` reads artifacts from a committed file by default, so the demo never depends on a running server.

## Deliberate omissions

Dropped from the SaaS blueprint. Each row names the trigger that would add it back.

| Omitted | Blueprint had | Add back when |
|---|---|---|
| `database` (Drizzle) | Multi tenant Postgres | Runs must persist across machines or users |
| `redis` | Cache and queues | Live polling at portfolio scale |
| `auth` app and package | Better Auth issuer | More than one operator |
| `payments` | Stripe behind a capability name | Someone is billed |
| Infisical | Secret management | More than one developer holds the key |
| Trigger.dev | Background jobs | Live control loop instead of replay. Nest `micro-use-queues` is the smaller first step. |
| Terraform | Non Vercel infra | Anything is hosted |

**Kept:** Bun workspaces · catalog versions · turbo · capability naming · `public`/`private` boundaries · one way layers · t3-env per package · docs as law · `.cursor/rules`.
