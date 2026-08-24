# Architecture

> Adapt this. It describes what we have and why, not a template to conform to.
> Naming and layout follow the work; if a name stops fitting, change it.

## Shape

```
/
├── web/          Next.js 15. The pitch at /, the replay viewer at /replay
├── core/         the agent. Framework free TypeScript          (not built yet)
├── api/          NestJS. FortyGuard capture, replay engine     (not built yet)
├── fixtures/     captured days, committed, deterministic
└── docs/
```

Three workspaces, flat. No `apps/` or `packages/` nesting: with this few surfaces it adds depth and buys nothing.

**The pitch page and the replay viewer are one Next.js app**, not two. They share a design language and deploy together; splitting them would be SaaS habit, not a requirement.

## What is worth keeping from the blueprint

Four principles, because each pays for itself here. The rest was ceremony for a product with tenants and billing.

| Principle | Why it applies |
|---|---|
| **Vendors hide behind a capability name** | FortyGuard lives in `core/weather/fortyguard/`. Nothing outside that folder knows the vendor exists, so swapping to a fixture replay is a one line change. |
| **One way dependencies** | `web` and `api` import `core`. `core` imports nothing of theirs. This is what lets the agent be tested without a browser or a server. |
| **Pure decision logic** | Policies are `(state) => Proposal[]`, no I/O. Milliseconds to test, and the same function runs in a script, a server, or the browser. |
| **Thin transport** | Controllers and components call `core` and render. No thresholds or physics in a route handler or a `.tsx` file. |

**The test that matters:** deleting `web/` and `api/` must leave `core/` working and its tests passing. If it does not, logic has leaked outward.

## core layout

One workspace, folders by capability. Layer order is the import order.

```
core/src/
├── contracts/   zod schemas: EnvSnapshot, Command, DecisionRecord, RunArtifact
├── weather/     FortyGuard client, normalization, solar projection
│   └── fortyguard/   ← the only place the vendor name appears
├── building/    building and facade metadata, segment binding
├── twin/        thermal mass, damper mixing, indoor PM2.5 and CO2
├── bms/         BmsAdapter interface + simulated implementation
├── policies/    precool · tint · airQuality · demandResponse — all pure
└── copilot/     arbiter, control loop, and the baseline strategy
```

A folder may import from folders above it, never below. `policies` may not import `copilot`; `twin` may not import `policies`.

Split any of these into its own workspace only when something outside `core` needs it independently. Nothing does yet.

## web

```
web/
├── app/          layout.tsx, page.tsx, globals.css
├── components/   island-nav · hero · replay-panel · reveal · pixel-mark
└── lib/          fixture.ts (moves to core/weather once that exists), cn.ts
```

| Rule | Why |
|---|---|
| Server Components by default | Only `replay-panel`, `island-nav`, and `reveal` need `'use client'`, and each for a concrete reason: Canvas, state, IntersectionObserver |
| Design tokens in `globals.css` `@theme` | Every colour, easing, and font resolves to a token, so an off system value is visibly wrong |
| Spacing uses Tailwind's default steps | Its scale already contains the approved set. Any other step is a design system violation, not a Tailwind one. |
| Fonts through `next/font/google` | Self hosted at build time. No CDN, no layout shift, survives a strict CSP. |

## api, when it exists

NestJS, organized by feature (`capture/`, `replay/`, `artifacts/`, `health/`), never by technical layer. It wraps `core`; it never owns logic. Swappable dependencies bind by symbol token so the simulated BMS becomes a real one without touching a caller. Details and the narrowed rule set: [`../.agents/skills/nestjs.md`](../.agents/skills/nestjs.md).

It runs on **Node**, not the Bun runtime. Bun stays the package manager and the `core` test runner.

**Open question:** the demo runs offline from a committed artifact, which Next.js can read server side on its own. If `api` earns its place it will be because capture and the replay engine want a real home, not because the UI needs a server.
