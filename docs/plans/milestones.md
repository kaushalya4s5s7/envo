# Milestones

Single live plan. Update the **Status** column as work lands; do not keep a second plan elsewhere.

| # | Milestone | Status |
|---|---|---|
| M0 | Foundations — repo, web app, hero | ✅ done |
| M1 | Contracts and primitives | ✅ done |
| M2 | The building and its physics | ✅ done |
| M3 | The decision layer | ✅ done |
| M4 | The signal — synthetic, then captured | ✅ **real capture working end to end** |
| M5 | The replay surface | ✅ done |
| M6 | The sandbox — BOPTEST | ✅ built · re scoring after fixes |
| M7 | Accounts, buildings, advisory onboarding | ⬜ |
| M8 | The agent — LLM layer | ⬜ |
| M9 | Pitch readiness | ⬜ |
| — | Shadow and autonomous phases | ⬜ **post hackathon**, see the product flow |

## ✅ M3.8 — the agent now earns its keep on real data

Against the real 2026-08-07 capture (86 → 103.5 °F, ozone 21 → 151, cloud 0 → 100%):

| Metric | Copilot | Baseline |
|---|---|---|
| **Cooling energy in the peak window** (16:00 to 20:00) | **52 kWh** | 71 kWh — **26.1% less** |
| Cooling energy, whole day | 195 kWh | 233 kWh |
| Hours sealed during the ozone event | **4** | 0 |
| Max zone temperature | 73.9 °F | 73.9 °F — comfort identical, ceiling is 78 |

All modeled by the twin, never metered. Four bugs fixed, each caught by a failing test first:

| # | Bug | Fix |
|---|---|---|
| 1 | Ozone override never fired: a real event touching AQI 151 for one hour was missed | `PERSIST_CLOSE = 1`, decided on safety grounds. Reopen stays at 4, so the asymmetry widened. |
| 2 | Twin had no thermal mass, so pre cooling could not physically help | `massTempF` charges and discharges; stored coolth offsets plant load |
| 3 | A 103 °F day never troubled the plant | `CAPACITY_F` 22 → 10, sized to hold a 95 °F design day |
| 4 | **Pre cooling never ended.** The setpoint dropped at 11:00 and stayed down all day, which is running cold, not pre cooling. It cost *more* than doing nothing. | Policy A is now two phases: **charge** then **coast**. It floats the zone up during the peak and spends the stored mass. |

Bug 4 was invisible against the synthetic fixture and only appeared on real data.

## 🔒 Blocked, needs you

| # | Need | Blocks | Where to put it |
|---|---|---|---|
| ~~B1~~ | ~~FortyGuard API docs~~ | — | ✅ **received 27 Aug 2026.** Distilled to [`api.md`](../reference/fortyguard/api.md) |
| ~~B2~~ | ~~API key and tier~~ | — | ✅ **key received, tier probed = PREMIUM.** All parameters in one call; segmentation available. Rotate the key after the hackathon: it was pasted in chat. |
| B3 | **Demo location** — US city, ideally a lat/lon | Building metadata, facade azimuth | Tell me and it goes in `core/src/building` |
| B4 | **Hero actuator** — confirm Policy C (air quality) as the demo's lead | Build order inside M3 | [`scope.md`](../decisions/product/scope.md) D2. My recommendation is C; it is currently unconfirmed. |
| B7 | **Hourly irradiance, or not.** `solar_irradiance` is a **period average**, so one range call yields one DNI value. Hourly beam costs one `filter_type: 1` call per hour, 17 per day. Options: accept the daily average plus solar geometry, or spend the calls. Credits are ample (5M) so this is a latency and complexity question, not a cost one. | Policy B fidelity | Your call |
| B6 | **EPA AQI breakpoint table.** Needed in M4 to convert `air_quality_pm2p5:idx` into the µg/m³ the twin works in. The 2024 revision changed the PM2.5 breakpoints and I am not confident which version is current. | M4 normalization, and the demo's indoor numbers | Paste the current table, or confirm which revision to use |
| ~~B5a~~ | ~~native interval~~ | — | ✅ **`"1h"`, confirmed live.** The provisional `INTERVAL_MIN = 60` was right. |
| ~~B5~~ | ~~`PERSIST_CLOSE` on an hourly grid~~ | — | ✅ **resolved: `PERSIST_CLOSE = 1`.** Decided on safety grounds; the ozone override now fires on the real event. |

**B1 is cleared.** The vendor adapter is unblocked for code; only live capture still needs B2 and B3. M1 through M5 build against synthetic fixtures generated from the `EnvSnapshot` contract we own. When real docs land, a captured day replaces a synthetic one at the same interface and nothing downstream changes.

---

## M0 — Foundations ✅

Bun workspaces, turbo, Next.js 15 with Tailwind v4 tokens, hero with the pixel segment map. Builds clean, typechecks, statically prerendered.

## M1 — Contracts and primitives ✅

Scaffold `core` and everything with no dependencies.

| Step | Deliverable | Done when |
|---|---|---|
| M1.1 | `core` workspace, tsconfig, `bun test` wired | ✅ 35 tests, 4 files |
| M1.2 | `core/src/observability` — logger with a redirectable sink | ✅ |
| M1.3 | `core/src/contracts` — zod for all eight shapes | ✅ each parses a valid sample and rejects malformed ones |
| M1.4 | `core/src/utils` — thresholds, hysteresis latch, 15 minute grid, unit conversion | ✅ |

**Gate:** ✅ thresholds live in one file; the hysteresis latch is proven against an oscillating signal (naive comparison flips 39 times, the latch flips once) before any policy uses it.

## M2 — The building and its physics ✅

| Step | Deliverable | Done when |
|---|---|---|
| M2.1 | `core/src/building` — building, facades with azimuth, segment binding | ✅ 5 tests. Demo building is a **placeholder pending B3**. |
| M2.2 | `core/src/twin` — plant capacity, damper mixing, indoor PM2.5, CO₂, cooling energy | ✅ 15 tests, including the CO₂ against PM2.5 tradeoff that Policy C must arbitrate |
| M2.3 | `core/src/bms` — `BmsAdapter`, `SimulatedBms`, per actuator rate limiter, intent vs observed `verify` | ✅ 9 tests. Budget is per actuator and rolls hourly. |

Built test first throughout. The twin's first implementation let outside air dilute the zone
directly and converged to 70 °F against a 68 °F setpoint; the test caught it and the model was
replaced with a finite capacity plant that holds setpoint until load exceeds it.

**PM2.5 in the twin is µg/m³ concentration, never AQI.** Mixing AQI linearly is physically wrong,
so the conversion belongs at the normalization boundary in M4.

## M3 — The decision layer ✅

Hero first, per [`scope.md`](../decisions/product/scope.md) D2 (**confirm B4**).

| Step | Deliverable | Done when |
|---|---|---|
| M3.1 | Policy C — air quality override | Closes after exactly `PERSIST_CLOSE`, reopens only after `PERSIST_REOPEN`, **zero chatter** across a full fixture |
| M3.2 | Policy A — pre cool | Setpoint ramps ahead of the forecast peak; twin shows the coast |
| M3.3 | Policy B — tint | West facade tints at the right hour; an overcast fixture does not trigger |
| M3.4 | Policy D — demand response *(stretch, first to cut)* | Bid sized from segment forecast |
| M3.5 | `core/src/copilot` — arbiter per [`arbitration.md`](../decisions/product/arbitration.md), control loop, `DecisionRecord` emission | Hot and smoky resolves to closed damper with the energy cost logged; **CO₂ purge schedules into the cleanest forecast window, not a fixed interval** |
| M3.6 | `baseline` strategy behind the same interface | Both run the same loop against independent twins from one fixture. Only the **signal** differs. |

**GATE 2 ✅** — the artifact alone tells the story. Printed as a table with no UI, the run reads:
pre cool at 10:00 (copilot only, the baseline has no forecast), tint on both as beam climbs,
intake shut at 19:00 UTC when PM2.5 sustains above AQI 151, indoor particulates decaying while the
baseline keeps climbing, reopen at 02:00 after the longer clean window. 150 tests, 100% of
commands carry a rationale.

> ### ⚠️ B5 is now quantified, and it is the demo's weakest point
> On the hourly grid, `PERSIST_CLOSE = 2` means the building **breathes unhealthy air for two full
> hours** before the intake shuts — AQI 168 at 18:00, then 178 at 19:00, and only then does it act.
> By that point indoor particulates have already peaked, so the headline gap is
> **6.8 against 7.9 µg/m³**, which is far less than the story deserves.
>
> The copilot's real advantage shows in the decay afterwards: it falls to 1.2 while the baseline
> holds above 5.0.
>
> [`thresholds.md`](../decisions/product/thresholds.md) forbids tuning a threshold to make a demo
> look better, so this is **not** being changed without a decision. See B5.

## M4 — The signal ⬜

| Step | Deliverable | Blocked |
|---|---|---|
| M4.1 | `core/src/weather/synthetic.ts` — generates fixtures against `EnvSnapshot` | no |
| M4.2 | Normalization: unit alignment, timebase to the 15 minute grid, forecast trim | no |
| ~~M4.3~~ | ~~solar~~ | ✅ done early in M3.3 |
| M4.4 | `core/src/weather/fortyguard/` — real client | 🔒 **B1** |
| M4.5 | Capture a real day → `fixtures/`, replace the synthetic one | 🔒 **B1, B2, B3** |

## M5 — The replay surface ⬜

| Step | Deliverable | Done when |
|---|---|---|
| M5.1 | `/replay` route in `web` | Reads a committed artifact server side |
| M5.2 | Split screen, both strategies, shared time axis, scrubber | Divergence visible without narration |
| M5.3 | Rationale panel wired to `DecisionRecord` | The close event shows its full record on screen |
| M5.4 | Metrics with assumptions rendered inline | Indoor PM2.5 avoided, energy delta, comfort hours, changes per hour, rationale coverage |
| M5.5 | `synthetic: true` badge whenever the fixture is not captured | Never presents synthesized data as captured |

## M6 — The sandbox, BOPTEST ⬜

Plan: [`../decisions/platform/sandbox.md`](../decisions/platform/sandbox.md).
Independent physics and independent KPIs, so the savings number is not scored by the same code that
produced it.

| Step | Deliverable | Done when |
|---|---|---|
| M6.1 | `docker compose up web worker provision`, pick the closest archetype | The emulator answers `GET /measurements` locally |
| M6.2 | Record a real response into `docs/reference/boptest/samples/` | Endpoint shapes stop being README quotes and become facts |
| M6.3 | `BoptestAdapter implements BmsAdapter`, bound by symbol token | Policies, arbiter, and loop unchanged. Deleting it leaves the twin path working. |
| M6.4 | Run the agent against the emulator, score with `GET /kpi` | ✅ three arm experiment: builtin, citywide, copilot |
| M6.5 | Surface the divergence between BOPTEST weather and FortyGuard on screen | ⬜ |

**Gate:** ✅ a savings figure we did not compute ourselves — and it said we were **losing**.

### What the sandbox caught

Full analysis: [`../decisions/platform/sandbox-findings.md`](../decisions/platform/sandbox-findings.md).
Our twin claimed **26.1% savings**; BOPTEST scored the same agent on the same day at **2× the
energy** and **219× worse** indoor air quality. Four defects, none of which our own tests could see:

| # | Defect | Kind |
|---|---|---|
| 1 | Purge searched for the cleanest **PM2.5** hour while **ozone** was the hazard | Policy bug |
| 2 | No deadline: a monotonically improving forecast deferred the flush forever, so the CO₂ ceiling was advisory rather than the health priority `arbitration.md` defines | Policy bug |
| 3 | The purge had an engage threshold and **no release value**, so once 1 and 2 were fixed it oscillated eight times. Our own `honesty-rails.md` rail 1 forbids exactly this. | Policy bug |
| 4 | The twin's CO₂ ramped at 547 ppm/h and settled at 2050 ppm, against BOPTEST's measured 230 ppm/h and ~410 ppm. Two constants wrong: per occupant generation, and a missing ventilation effectiveness term. | Model error |

Defect 4 is the one that matters most strategically: **we only knew the twin was wrong because
something we did not write disagreed with it.**

### Still open from the findings

- Nominal setpoint is our constant, not the building's. `no-seal` alone cost 2.08× builtin by
  holding 72 °F where the building runs 75.2 °F. **The setpoint must be read from the building**,
  which is what the shadow phase in [`../flows/product-flow.md`](../flows/product-flow.md) is for.
- Pre cool charge depth needs per building tuning. The coast mechanism works: hourly energy drops
  3 to 4× when it engages.

## M7 — Accounts, buildings, advisory onboarding ⬜

Plan: [`../flows/product-flow.md`](../flows/product-flow.md), Phase 1.

| Step | Deliverable | Done when |
|---|---|---|
| M7.1 | Add `auth` and `database`. Both triggers in [`../deployment.md`](../deployment.md) have fired. | An org and a user persist across a restart |
| M7.2 | `/signup`, `/login`, org creation | — |
| M7.3 | `/onboarding/address` — geocode, real heatmap tiles, **confirm your tile** | The segment binding is a user action, not a guess |
| M7.4 | `/onboarding/envelope` — area, floors, facades, occupancy, comfort bounds | Replaces the hardcoded `demoBuilding` |
| M7.5 | `/onboarding/first-run` — capture, run, render | **Value inside two minutes with zero building access** |
| M7.6 | `/app` today view and `/app/decisions` audit log | — |

**Gate:** a stranger can sign up, type an address, and see their own building's day, without us
touching anything they own.

## M8 — The agent ⬜

Today the system is a deterministic controller. Every `rationale` is a template string, so
[`../idea.md`](../idea.md) line 270 currently overclaims. Two layers fix that:

| Step | Deliverable |
|---|---|
| M8.1 | **Explanation.** An LLM reads the `DecisionRecord` stream and writes the operator facing reasoning, and answers questions about a run. Never touches control. |
| M8.2 | **Arbitration under novel conflict.** Policies propose; the LLM weighs combinations the fixed priority table does not cover; the existing rails clamp the output. |
| M8.3 | Show a rail **rejecting** an LLM proposal on screen | 
| M8.4 | Deterministic policies remain the fallback when the model is unavailable or its output fails contract validation |

**Gate:** the rationale claim becomes true, and an unsafe model output is visibly refused.

## M9 — Pitch readiness ⬜

| Step | Deliverable | Done when |
|---|---|---|
| M9.1 | Re verify every research claim in [`idea.md`](../idea.md) Appendix B, and the EPA AQI breakpoint table | Zero ⚠️ rows. Unsourced claims cut from the script. |
| M9.2 | Rehearse ×3, timed | Opening line, demo, five objections from memory |

**Gate:** the smoke moment lands in under 20 seconds of demo time.

---

## Cut list — in order, no debate

1. Policy D (M3.4)
2. Portfolio view → single building
3. Ozone as a second pollutant (PM2.5 alone carries Policy C)
4. Policy B refinements (keep basic tint, drop the daylight floor)

**Never cut:** Policy C · the rationale panel · the split screen · the honesty rails.

## Definition of done

- [ ] `bun run check-types` and `bun test` clean
- [ ] Every threshold traced to `thresholds.md`; no inlined numbers
- [ ] `core` imports nothing from `web` or `api`; no cycles
- [ ] FortyGuard appears only inside `core/src/weather/fortyguard/`
- [ ] 100% of commands carry a populated rationale
- [ ] Demo runs offline from a committed fixture
- [ ] Every modeled number shows its assumptions on screen
- [ ] `docs/idea.md` Appendix B has zero unverified rows
