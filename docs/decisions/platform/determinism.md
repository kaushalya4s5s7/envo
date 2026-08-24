# Decision — Determinism

**Status:** locked · **Platform law.**

## Scope: this governs the demo, not the product

Amended 2026-08-29. This document was read as "the product never calls the API live", which is not
what it decided and not a product we could ship. It governs **the judged demo surface** — `/replay`,
the fixtures, and the tests.

| Surface | Rule | Why |
|---|---|---|
| `/replay`, tests, fixtures | **Deterministic.** Committed fixture, identical every run. | A rate limit on stage kills the demo, and the split-screen comparison is only fair if both controllers consume an identical stream. |
| `/onboarding`, `/app?capture=` | **Live.** Real capture for the address the user types. | "An address is enough" is the entire Phase 1 claim. A walkthrough that showed one recorded building to every visitor would be a demo pretending to be a product. |

Both paths run through `buildArtifact` in `core/src/copilot/artifact.ts` and produce the identical
shape, so a live day and the committed day stay comparable. Neither path can silently become the
other: `/app` with no `?capture=` says in plain text that it is showing the committed demo day.

## No live API calls during the demo

`weather-intel` has two sources behind one interface:

| Source | Use |
|---|---|
| `live` | Development, and **fixture capture only** |
| `replay` | Everything else — dev loop, tests, and **the judged demo** |

Capture a real FortyGuard day once → `fixtures/<scenario>.jsonl` → commit it. Every run after that is deterministic and offline.

**Why:** a rate limit, a network drop, or a slow async heatmap poll on stage kills the demo. This also makes the split-screen comparison reproducible — both controllers must consume the *identical* signal stream or the comparison is rigged.

## Synthetic first, captured later

The vendor adapter is blocked until FortyGuard docs land, so fixtures start **synthetic**: generated
by `core/src/weather/synthetic.ts` against the `EnvSnapshot` contract we own. Every downstream layer
(policies, twin, arbiter, replay UI) builds and tests against them without waiting.

When real capture works, a captured day replaces the synthetic one at the same interface. Nothing
downstream changes. This is the entire reason normalization owns the shape rather than the vendor.

**Any artifact built from a synthetic fixture carries `synthetic: true`, and the UI shows it.**

## Fixture requirements

The hero scenario must contain, in one continuous day: a forecast apparent-temp peak · a clean free-cooling window · a west-façade DNI climb · a **PM2.5 spike crossing the Unhealthy breakpoint and sustaining ≥ 2 intervals** · a subsequent cleaner window for the CO₂ purge.

If a captured real day lacks the spike, **synthesize the spike into a real day and label the fixture `synthetic: true`** — the artifact and the UI must both surface that flag. Do not present a synthesized event as captured.

## Run artifact

`replay` writes one `RunArtifact` per run: metadata (fixture id, tier, synthetic flag, threshold snapshot) + per-interval `EnvSnapshot`, `TwinState`, `Command[]`, `DecisionRecord[]` for **both** strategies.

`console` reads the artifact and renders. It never computes decisions.

**Consequence for the schedule:** the agent is provable on Day 2 with zero UI, and the UI is buildable on Day 3 against a frozen file. This split is why the plan survives a bad day.
