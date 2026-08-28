# Flow — Organization to autonomous control

How a real customer goes from signing up to letting software drive their building. Modelled on how
the incumbents actually onboard, and deliberately inverted where we can do better.

## What the market does

| Product | Install | Time to first value | Autonomy |
|---|---|---|---|
| BrainBox AI | Edge device into the BMS, 2 to 3 hours | **6 to 8 week learning period** | Adjusts every 5 minutes |
| Runwise | Heat computer plus wireless sensors, 1 day | After install | Controls on indoor conditions |
| Parity, EcoPilot | Gateway | After install | **No upfront cost, paid from verified savings** |
| CIM PEAK | Software | Weeks, and they advertise "months to weeks" as a feature | Analytics |

Their universal sequence:

```
qualify → site survey → install → POINT MAPPING → learn 4-8 weeks → shadow → autonomy → M&V
```

**Point mapping is where products die.** Manual point mapping and naming reconciliation consumes
**30 to 40% of BMS integration labour**: a building exposes thousands of BACnet points named things
like `AHU2_SAT_SP` and a human decides which is a supply air temperature setpoint. Project Haystack
tagging is the standard remedy.

**Nobody is self serve.** Physical access, liability, and point mapping make it impossible.

## Why ours can invert that

Two facts about this product, both established by probing rather than assumed:

1. **Our intelligence comes from outside the building.** A FortyGuard segment binding needs an
   address, not a gateway. Every competitor must install something before saying anything useful.
2. **There is no outdoor learning period.** We already know what the weather does on that block for
   the next 12 hours, on day one. BrainBox spends 6 to 8 weeks learning what we start with.

So we deliver value **before** integration, not after it:

```
sign up → add building → ADVISORY (minutes, no hardware)
                       → SANDBOX  (autonomy against a simulated copy)
                       → SHADOW   (read only, priced against reality)
                       → AUTONOMOUS (per actuator, guardrailed)
```

The sandbox step is the one nobody offers, and it addresses the objection that actually blocks these
deals: **nobody wants to hand write access to a building to software they have not watched drive.**

---

## Domain model

| Entity | Notes |
|---|---|
| **Organization** | The customer. Owns buildings and billing. Never a personal account. |
| **User** | Belongs to an org with a role. `owner` · `operator` · `viewer`. |
| **Building** | Address, geocode, **segment binding**, envelope profile, occupancy schedule |
| **Connection** | How we reach the controls: `none` · `sandbox` · `bms_readonly` · `bms_write` |
| **PointMap** | Vendor point name → our canonical actuator or measurement |
| **AutonomyGrant** | Per building, **per actuator**, with guardrails and an expiry |
| **Run** | A captured day plus the decisions taken, replayable |
| **Decision** | The audit record. Every command has one. |

Role rules: `viewer` reads. `operator` overrides and pauses. **Only `owner` grants autonomy.**

---

## Phase 1 — Advisory · self serve, minutes

The whole phase touches nothing in the customer's building.

| # | Step | What happens | Built |
|---|---|---|---|
| 1 | ~~Sign up~~ | **Cut.** No account before the first answer — see [`dashboard-and-auth.md`](../decisions/product/dashboard-and-auth.md). A login in front of the first answer discards the wedge. | n/a |
| 2 | **Address** | Geocode → real FortyGuard heatmap box around it | ✅ live |
| 3 | **See the tile** | The real tiles for their block, their cell outlined. Their block is visibly a different temperature from the next one. | ✅ live |
| 4 | Envelope profile | Floor area, taken with the address so the capture has everything it needs. Facades, occupancy and comfort bounds are **assumed and shown as assumptions**. | partial |
| 5 | **First run** | Capture the day plus forecast for that segment, run the policies, render the day | ✅ live |
| 6 | Deliver | "Here is your day, here is what we would have done, and here is why" | ✅ |

**Gate: value inside two minutes, with zero access.**

Measured against the real API, three cities, 2026-08-29:

| Address | Tiles visible | Full capture |
|---|---|---|
| 233 S Wacker Dr, Chicago | ~20 s | 108 s |
| 400 W 15th St, Austin | 25 s | 144 s |
| 600 Wilshire Blvd, Los Angeles | ~25 s | ~140 s |

The heatmap returns about a minute before the parameters do, so the tiles render as soon as they
land rather than after the whole capture. The gate holds.

**Not built: persistence.** A capture lives in memory for thirty minutes. The UI says so.

What they get: the daily plan, the decision log with rationales, and a modelled saving. What they do
**not** get: any claim that it happened. It is clearly labelled advisory.

## Phase 2 — Sandbox · autonomy without risk

Before anyone connects anything, they watch the agent drive a **simulated** building end to end.

| # | Step |
|---|---|
| 1 | Pick the BOPTEST archetype closest to their building, and we name which one |
| 2 | The agent runs the full loop against it: decide → **write setpoints** → measure → verify |
| 3 | Score with BOPTEST's **own** KPIs, not ours — energy, thermal discomfort, cost |
| 4 | Show the guardrails working: a rejected command, a rate limit, a comfort clamp |

**This is the trust step.** It answers "what happens when it gets something wrong" with a recording
rather than a promise. See [`../decisions/platform/sandbox.md`](../decisions/platform/sandbox.md).

## Phase 3 — Shadow · read only, priced

| # | Step |
|---|---|
| 1 | Connect: BACnet/IP gateway, or a vendor API. Read only credentials. |
| 2 | **Point discovery** → we propose a mapping → a human confirms it. The Haystack step, assisted, never silent. |
| 3 | Run live alongside the existing controller for two to three weeks |
| 4 | Report the gap: what we would have done, what the building did, what the difference costs |

Shorter than the incumbent 6 to 8 weeks because the outdoor model needs no learning. We are learning
**this building's** thermal response, not the weather.

**Gate: the gap is priced in the customer's own utility rate before anyone discusses write access.**

## Phase 4 — Autonomous · per actuator

| # | Step |
|---|---|
| 1 | Owner grants autonomy **one actuator at a time**. Damper first is the wrong order; setpoint first is the reversible one. |
| 2 | Configure guardrails: comfort bounds, changes per hour, blackout windows, occupied hours |
| 3 | Health priority is **not** configurable. The air quality override cannot be disabled. |
| 4 | Kill switch on every screen. Operator override from a phone. |
| 5 | Every command logged with its rationale and reversal condition |
| 6 | Monthly M&V against the shadow baseline |

Grants **expire** and must be renewed. Silence is not consent to keep driving someone's building.

---

## Surfaces

```
/                          marketing                                   (built)
/onboarding                address + area → live capture → your day     (built)
  ├── address              geocode, then a real FortyGuard capture
  ├── your block           the real tiles for that address, cell outlined
  └── your day             decisions for that building        ← Phase 1 gate
/api/capture               POST starts a capture, GET polls it          (built)
/app?capture=<id>          today, for the building just captured        (built)
  ├── /                    the committed demo day when no capture       (built)
  ├── /replay              the split screen, committed fixture          (built)
  ├── /app/sandbox         agent drives BOPTEST, emulator scores it     (built)
  ├── /app/decisions       audit log: rationale, trigger, reversal      (built)
  ├── /app/connect         point discovery and mapping                  (built)
  ├── /app/autonomy        per actuator grants, applied to a real day   (built)
/api/sandbox               POST runs live, GET polls or returns recorded (built)
/api/points                GET discovers points, live or committed       (built)
~~/signup  /login~~        cut from Phase 1 — dashboard-and-auth.md
/app
  ├── /decisions           audit log: rationale, trigger, reversal condition
  ├── /buildings           portfolio                          needs persistence
  └── /settings            org, members, roles, billing       needs auth
```

## Commercial shape

The market has settled on **outcome pricing**: Parity and EcoPilot both charge nothing upfront and
take a share of verified savings. That fits our phase ladder exactly, because Phase 3 produces the
verified baseline that Phase 4 is billed against.

## What this costs us architecturally

Phases 1 and 3 need real accounts and stored buildings, which means adding back two things
[`../deployment.md`](../deployment.md) deliberately dropped. Both triggers have now fired:

| Dropped | Trigger stated | Fired? |
|---|---|---|
| `auth` | "more than one operator" | ✅ orgs, roles, invitations |
| `database` | "runs must persist across machines or users" | ✅ buildings, runs, grants, point maps |

## Scope warning

**This is a product roadmap, not a three day build.** Sequenced against the hackathon:

| | In the hackathon | After |
|---|---|---|
| Phase 1 Advisory | ✅ **built** — `/onboarding` runs a live capture per address | |
| Phase 2 Sandbox | ✅ **built** — `/app/sandbox`, live BOPTEST run or the committed one | |
| Phase 3 Shadow | ✅ **point discovery and mapping built** — `/app/connect`, real discovery against a live building interface. Only a real BMS credential remains. | connect to a real BMS |
| Phase 4 Autonomous | ✅ **per actuator grants built** — `/app/autonomy`, gating real commands from a real day | grant against a live connection |
| Auth and database | Minimum viable: one org, one building, real persistence | proper roles, invitations, billing |

Cut order inside the hackathon is unchanged: [`../decisions/product/scope.md`](../decisions/product/scope.md).
