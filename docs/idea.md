# Envo

> **The outdoor brain for buildings that already have the controls but not the signal.**

A per-building agent that fuses FortyGuard's full environmental stack — forecast wet-bulb,
apparent temperature, ozone, PM2.5, direct-beam irradiance, and surface segmentation — into
setpoint, shade, damper, and demand-response commands, giving the building automation systems
buildings already own the outdoor foresight they currently lack.

| | |
|---|---|
| **Status** | Built and independently scored. See the correction block below. |
| **Primary track** | Track 06 — Agentic AI |
| **Supporting tracks** | Track 02 (Future Buildings & Energy), Track 07 (Data Analysis & Correlation), Track 04 (Government & Environment) |
| **Build window** | 3 days |
| **Actuator** | Digital — simulated BMS / digital twin emitting real setpoint commands |
| **Hardware required** | None |
| **Geography** | US-only, 60–100 m segment resolution |

---

> # ⚠️ Read this first — what testing changed
>
> This document was written **before** we probed the API and before we scored ourselves against an
> independent emulator. Both disproved parts of it. The corrections below supersede anything later in
> this file that contradicts them. Full evidence:
> [`docs/decisions/product/what-we-can-claim.md`](docs/decisions/product/what-we-can-claim.md) and
> [`docs/decisions/platform/sandbox-findings.md`](docs/decisions/platform/sandbox-findings.md).
>
> | This document claims | Measured reality |
> |---|---|
> | Hyperlocal PM2.5 and ozone at 60 m | **Air quality is metro scale.** Midtown Manhattan and Newark, 15 km apart, returned an identical 156 AQI in the same hour. |
> | "The plume crosses your block at 15:00" | PM2.5 is a **daily** value on historical dates — 156.2 at 08:00 and 156.1 at 20:00 on the 2023 wildfire day. |
> | 26.1% less cooling energy | **Our own twin said that. BOPTEST said we used 2× the energy.** After fixing five defects the honest figure is **cost −3.9%** against the emulator's own controller, with energy still +15%. |
> | The rationale field is what makes this an agent | It was a **template string** until a Gemini layer was actually wired in. It is now real, with four deterministic rails around it. |
>
> **What survived, and is reproducible:** temperature genuinely varies per block — 4,265 distinct
> tiles spanning 2.8 °F across 23 mi² in the same minute — the 12 hour forecast is real, and the
> air quality override is still a decision nobody automates. The thesis moved from "hyperlocal
> everything" to **hyperlocal heat, metro air quality, and an agent that arbitrates between them.**

---

## Table of Contents

1. [The One-Line Pitch](#1-the-one-line-pitch)
2. [The Problem — Felt, Not Hypothesized](#2-the-problem--felt-not-hypothesized)
3. [Why This Problem Is Unsolved](#3-why-this-problem-is-unsolved)
4. [The Design Test This Idea Had To Pass](#4-the-design-test-this-idea-had-to-pass)
5. [The Insight](#5-the-insight)
6. [Solution Architecture](#6-solution-architecture)
7. [The Four Decision Policies](#7-the-four-decision-policies)
8. [The Conflict Engine — Why an Agent, Not a Threshold](#8-the-conflict-engine--why-an-agent-not-a-threshold)
9. [FortyGuard API Call Sequence](#9-fortyguard-api-call-sequence)
10. [Control Engineering Rails](#10-control-engineering-rails)
11. [The Demo](#11-the-demo)
12. [Stress Test — Every Objection and the Answer](#12-stress-test--every-objection-and-the-answer)
13. [Honest Limitations](#13-honest-limitations)
14. [3-Day Build Plan](#14-3-day-build-plan)
15. [Track Mapping and Scoring Strategy](#15-track-mapping-and-scoring-strategy)
16. [Success Metrics](#16-success-metrics)
17. [Open Decisions — Blocking](#17-open-decisions--blocking)
18. [Appendix A — Parameter → Actuator Matrix](#appendix-a--parameter--actuator-matrix)
19. [Appendix B — Research Provenance](#appendix-b--research-provenance)
20. [Appendix C — Glossary](#appendix-c--glossary)

---

## 1. The One-Line Pitch

**For** commercial building operators and portfolio managers
**who** already run smart HVAC, automated shades, economizer dampers, and demand-response clients,
**Envo** is a decision-and-command layer
**that** replaces their single coarse citywide weather feed with per-building, forecast,
multi-parameter outdoor intelligence — so their existing actuators finally know what is
actually happening on their block, before it arrives.

**Unlike** rooftop AQI sensors (expensive, rare, reactive, single-parameter) or generic
AI building-automation (optimizes on weather + price at city resolution),
**our product** fuses thermal, air-quality, and solar signals at 60–100 m and drives four
different actuators from four different slices of the same feed.

---

## 2. The Problem — Felt, Not Hypothesized

### 2.1 The scene

During the **July 2026 wildfire-smoke episodes**, Westchester County moved in and out of
air-quality advisories as smoke crossed New York from fires hundreds of miles away. The sky
changed color before some building operators had decided what to do with their rooftop units,
economizers, and outside-air fans.

The response was uncoordinated in a way that is diagnostic of a missing signal, not missing
equipment:

- By midday, **one property manager was still asking** whether every outdoor-air damper should be shut.
- **Another had already switched** to full recirculation.
- **A third had installed denser filters** the night before and was fighting weak airflow on the top floor.

Three buildings. Three different decisions. Same plume. Nobody had a signal telling them what
was actually crossing their block, or when.

### 2.2 The mirror-image failure

The opposite failure is equally documented and equally automated-by-default:

> When it's **104°F** out, default economizer logic shuts the outside-air damper and
> recirculates to save on cooling — **starving the space of fresh air.**

So the same physical lever fails in both directions:

| Condition | Default behavior | Consequence |
|---|---|---|
| Extreme heat | Damper closes to save cooling energy | Fresh air starved, indoor CO₂ climbs |
| Wildfire smoke | Damper stays open (no AQI input) | Building actively inhales PM2.5 |

Both failures share one root cause: **the controller cannot see outside its own façade.**

### 2.3 Why "just install a sensor" hasn't solved it

Automated AQI-driven damper control *already exists as a concept* — smart HVAC systems with
outdoor-air-quality sensors can automate damper closure when AQI thresholds exceed preset values.
This is the single most important fact in this document, and it cuts both ways:

- ✅ **It validates the idea.** The control action is real, accepted, and already engineered.
- ⚠️ **It means we are not first.** Our differentiator cannot be "we close dampers on AQI."

The gap is not the actuator. **The gap is the input.** See §5.

---

## 3. Why This Problem Is Unsolved

Three structural reasons the market has not closed this gap:

**1. Sensor economics don't scale to portfolios.**
A reference-grade rooftop PM2.5 + ozone sensor is a capital purchase, a calibration schedule,
and a maintenance line item — per building. Across a 40-building portfolio it is a program,
not a purchase. Most buildings therefore have zero outdoor air-quality input.

**2. Sensors are reactive by construction.**
A physical sensor tells you smoke has arrived. It cannot tell you smoke arrives in 90 minutes.
Pre-cooling, pre-positioning, and filter staging all require **lead time**, and lead time is
precisely what a point sensor cannot give.

**3. Weather feeds are the wrong resolution and the wrong breadth.**
A citywide forecast is one number for a metro. It does not know that this building's west
façade takes direct beam at 14:00 while the one across the park is shaded, or that the plume
front is on this block and not that one. And it delivers temperature — not wet-bulb, ozone,
PM2.5, and DNI on the same call.

The result: buildings have **excellent actuators driven by impoverished inputs.**

---

## 4. The Design Test This Idea Had To Pass

Before committing, the concept had to satisfy three constraints *simultaneously*. Most
candidate ideas satisfy two and fail the third.

| # | Constraint | Why it matters |
|---|---|---|
| **1** | **Consumes many parameters** — heat index, wet-bulb, ozone, PM2.5, split irradiance, segmentation | This is what makes it *only* possible on FortyGuard. Padding parameters is visible to judges. |
| **2** | **The actuator is digital** — software setpoints via API, no construction | Adopts fast, buildable in 3 days, demoable |
| **3** | **The digital knob and the multi-parameter signal live in the same locality** | Otherwise you are merely alerting, not controlling |

### Why the runner-up ideas failed

| Candidate | Passes | Fails |
|---|---|---|
| **Bus-stop heat shelters** | Maxes the parameter usage; strong human story | Actuator is a **physical awning** — no digital loop, no 3-day demo |
| **SolarSense** | Automates cleanly, clean digital actuator | Genuinely only needs **irradiance + temperature** — the rest of the stack is decoration |
| **Envo** | ✅ ✅ ✅ | *(see §13 for the honest limitations)* |

**Envo is the only candidate where using the full stack is required rather than padded** —
because each of the four actuators is driven by a *different* slice of it.

---

## 5. The Insight

### 5.1 The repositioning that makes this defensible

The naive framing — *"we built a building controller"* — collides head-on with an
existing, mature, patented market:

- **Automated demand response is routine in 2026.** A utility signal arrives, the BMS shifts
  HVAC setpoints a degree or two, noncritical loads drop, the building is compensated — with
  pre-cooling, setpoint queueing, and lighting adjustments pre-staged before the event.
- **FERC Order 2222** opened wholesale markets to *aggregated* distributed energy resources,
  so groups of buildings can now participate where single sites could not.
- **Coordinated shade-plus-HVAC control is patented and shipping** — systems that determine an
  energy-efficiency shade position versus a glare-protection position and drive the blinds accordingly.
- **Electrochromic smart glass** changes transparency on an electrical signal, AI-optimized across
  large commercial portfolios and integrated with BMS.
- **The frontier is explicitly agentic** — 2026 smart-building guides describe autonomous
  optimization that adjusts setpoints based on electricity demand, weather, and market price
  without human intervention.

Every one of those systems is real, built, and API-addressable. **We are not inventing the machine.**

### 5.2 What they all run on

Every system above is driven by one of exactly two weak inputs:

1. An **indoor** sensor, or
2. A **single coarse citywide** weather forecast.

**None of them sees, per building, the combination of forecast wet-bulb + ozone + PM2.5 +
direct-beam irradiance at 60–100 m resolution.**

That is the gap. It is narrower than "we control buildings," and it is far more defensible.

### 5.3 The positioning statement

> **We are not the controller. We are the outdoor brain the controllers are missing.**

This framing is:
- **Honest** — it does not overclaim autonomous control of life-safety equipment
- **Humble** — it credits the existing actuator ecosystem instead of pretending it does not exist
- **Defensible** — the differentiator is input *resolution and breadth*, which is exactly what FortyGuard uniquely provides
- **Commercially coherent** — it is a data/decision layer feeding APIs that already exist, which is the fastest-adopting shape of product in this space

---

## 6. Solution Architecture

### 6.1 The closed loop

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          ENVELOPE COPILOT                               │
│                                                                         │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐          │
│   │  SENSE   │───▶│  FUSE    │───▶│  DECIDE  │───▶│ ACTUATE  │          │
│   └──────────┘    └──────────┘    └──────────┘    └──────────┘          │
│        │                                                │               │
│        │                                                ▼               │
│        │                                          ┌──────────┐          │
│        └──────────────────────────────────────────│  VERIFY  │          │
│                        (feedback)                 └──────────┘          │
└─────────────────────────────────────────────────────────────────────────┘

 SENSE     FortyGuard: heatmap → segment → environmental parameters (now + 12h forecast)
 FUSE      Normalize, de-rate irradiance by cloud cover, align time bases, apply persistence
 DECIDE    Four policies (§7) + conflict arbitration (§8) → setpoint deltas with rationale
 ACTUATE   Emit BMS commands (simulated digital twin) — every command carries its "why"
 VERIFY    Log intent vs. observed state; a command on a screen is not proof of motion (§10.4)
```

### 6.2 Component breakdown

| Layer | Responsibility | Implementation |
|---|---|---|
| **Ingest** | FortyGuard API client, retry/backoff, response caching | Async Python client |
| **Normalize** | Unit alignment, cloud-cover de-rating of clear-sky irradiance, timestamp alignment to control interval | Pure functions, unit-tested |
| **State** | Rolling window of the last N intervals per building — required for hysteresis and persistence | In-memory ring buffer + JSON snapshot |
| **Policy** | Four independent decision policies, each pure: `(state) → proposed_command` | One module per policy |
| **Arbiter** | Resolves conflicting proposals into one coherent command set (§8) | Priority + constraint solver |
| **Actuator adapter** | Translates commands into BMS-shaped calls | Simulated BMS / digital twin |
| **Audit log** | Every decision: inputs, policy fired, threshold crossed, action, rationale | Append-only JSONL — **this is the demo's credibility** |
| **UI** | Split-screen comparison, timeline, parameter traces | Web dashboard |

### 6.3 Design principle: every command carries its rationale

No command leaves the agent without a structured explanation:

```json
{
  "timestamp": "2026-07-18T15:00:00-04:00",
  "building_id": "demo-nyc-001",
  "segment_id": "seg_40.7580_-73.9855",
  "actuator": "outside_air_damper",
  "command": { "position_pct": 0, "mode": "recirculate" },
  "policy": "air_quality_override",
  "trigger": {
    "parameter": "pm25_ugm3",
    "observed": 78.4,
    "threshold": 55.5,
    "aqi_category": "Unhealthy",
    "sustained_intervals": 2
  },
  "conflicts_overridden": ["economizer_free_cooling"],
  "cost": { "cooling_energy_delta_pct": 8.1 },
  "benefit": { "indoor_pm25_avoided_ugm3": 61.2 },
  "rationale": "Sustained PM2.5 above Unhealthy breakpoint at this segment. Closing intake and recirculating. Accepting an 8% cooling-energy penalty to protect occupant respiratory exposure. Will reopen when PM2.5 sustains below 35.4 for 3 intervals or indoor CO2 exceeds 1100 ppm, whichever is first.",
  "expires_at": "2026-07-18T15:15:00-04:00"
}
```

That `rationale` field is what a judge reads. **It does not by itself make this an agent** — until a model was wired in, every rationale here was a template string. See the correction block at the top of this file and `core/src/agent/`.

---

## 7. The Four Decision Policies

Each policy is driven by a **different** slice of the FortyGuard stack. That is not a
coincidence — it is the entire argument for why this project needs the full API.

### 7.1 Policy A — Pre-Cool Before the Peak

| | |
|---|---|
| **Actuator** | HVAC zone temperature setpoint |
| **Primary input** | Forecast **wet-bulb** / **apparent temperature**, next 12 h, at this segment |
| **Secondary** | Cloud cover, forecast confidence |
| **Real-world basis** | DR systems already pre-cool; we supply a per-building forecast instead of a citywide one |

**Logic**

```
IF   max(apparent_temp_forecast[t+2h : t+8h]) ≥ PRECOOL_TRIGGER
AND  current_apparent_temp < max_forecast - PRECOOL_HEADROOM
AND  time_now is within the cheap-energy / low-load window
THEN lower zone setpoint by PRECOOL_DELTA_F, ramped
     over PRECOOL_RAMP_MIN so the building coasts through the peak
```

**Default parameters** *(all tunable; these are starting values, not claims)*

| Parameter | Default | Rationale |
|---|---|---|
| `PRECOOL_TRIGGER` | 95 °F apparent | Peak-load territory in most US climate zones |
| `PRECOOL_DELTA_F` | 2.0 °F | Occupant-imperceptible; matches typical DR setpoint shift |
| `PRECOOL_RAMP_MIN` | 90 min | Thermal mass charge time for a mid-rise |
| `PRECOOL_HEADROOM` | 6 °F | Prevents pre-cooling when it's already peak |

**Why FortyGuard specifically:** a citywide forecast will pre-cool the shaded riverside tower
and the west-facing asphalt-surrounded low-rise identically. Their actual peaks differ by hours
and degrees. Segment-level forecast is the whole point.

---

### 7.2 Policy B — Tint / Lower Shades

| | |
|---|---|
| **Actuator** | Electrochromic glass tint level or motorized shade position, **per façade orientation** |
| **Primary input** | **DNI** (direct normal irradiance) resolved onto this façade's orientation, this hour |
| **Secondary** | DHI (diffuse), cloud cover octas, solar position, daylight-availability floor |
| **Real-world basis** | Coordinated shade–HVAC control is patented and shipping; we supply the actual beam load per orientation |

**Logic**

```
beam_on_facade = DNI × cos(angle_of_incidence(facade_azimuth, solar_position))
beam_on_facade = derate_for_cloud(beam_on_facade, cloud_cover_octas)   # ← REQUIRED, see §10.3

IF   beam_on_facade ≥ TINT_HIGH  → tint to DARK   (cut solar heat gain)
ELIF beam_on_facade ≥ TINT_MID   → tint to MEDIUM
ELSE                             → CLEAR          (harvest daylight, cut lighting load)

CONSTRAINT: never tint below DAYLIGHT_FLOOR lux at the work plane during occupied hours
```

**Default parameters**

| Parameter | Default | Rationale |
|---|---|---|
| `TINT_HIGH` | 500 W/m² on façade | Strong beam load; cooling penalty dominates daylight benefit |
| `TINT_MID` | 250 W/m² on façade | Transitional |
| `DAYLIGHT_FLOOR` | 300 lux work plane | Below this you trade cooling savings for lighting load — a net loss |

**Why FortyGuard specifically:** total irradiance is the wrong number. A west façade at 15:00
under high DNI is a furnace; the same total irradiance as mostly-diffuse on an overcast day is
not. **The beam/diffuse split is the decision-relevant signal**, and it is per-segment.

---

### 7.3 Policy C — Close Intake, Recirculate *(the safety override)*

| | |
|---|---|
| **Actuator** | Outside-air intake damper / economizer position, filtration mode |
| **Primary input** | **Ozone** + **PM2.5**, now and forecast, at this segment |
| **Secondary** | Wet-bulb (is free cooling even available?), indoor CO₂ proxy, occupancy schedule |
| **Real-world basis** | The confirmed July 2026 wildfire failure mode; we supply forecast + hyperlocal AQI so the building acts *before* the plume |

**Logic**

```
# --- Forecast pre-positioning (the thing a sensor cannot do) -----------------
IF   forecast_pm25[t+1h : t+3h] crosses UNHEALTHY_PM25
THEN stage filtration, pre-flush with clean air now, warn operator

# --- Reactive override ------------------------------------------------------
IF   (pm25 ≥ PM25_CLOSE  OR  ozone_ppb ≥ O3_CLOSE)
AND  sustained for PERSIST_CLOSE intervals
THEN damper → CLOSED, mode → RECIRCULATE + high-MERV
     log the cooling-energy penalty explicitly

# --- Reopen (asymmetric — see §10.2) ---------------------------------------
IF   (pm25 ≤ PM25_REOPEN AND ozone_ppb ≤ O3_REOPEN)
AND  sustained for PERSIST_REOPEN intervals        # longer than close
THEN damper → economizer control returns to Policy D / free-cooling logic

# --- CO2 escape hatch (the conflict, §8) -----------------------------------
IF   estimated_indoor_co2 ≥ CO2_CEILING
THEN force a timed purge during the *cleanest available forecast window*,
     even if outdoor AQI is still degraded — and log the tradeoff
```

**Default thresholds** — anchored to **EPA AQI breakpoints**, so they are externally
justifiable rather than invented:

| Parameter | Default | Anchor |
|---|---|---|
| `PM25_CLOSE` | 55.5 µg/m³ (24 h) | EPA "Unhealthy" breakpoint |
| `PM25_REOPEN` | 35.4 µg/m³ | EPA "Unhealthy for Sensitive Groups" lower bound |
| `O3_CLOSE` | 86 ppb (8 h) | EPA "Unhealthy" breakpoint |
| `O3_REOPEN` | 70 ppb | EPA "Moderate" upper bound |
| `PERSIST_CLOSE` | 2 intervals (30 min) | Reject single-sample spikes |
| `PERSIST_REOPEN` | 4 intervals (60 min) | Asymmetric — slow to trust clean air |
| `CO2_CEILING` | 1100 ppm | Common IAQ ceiling (~700 ppm above outdoor) |

> ⚠️ **Verify EPA breakpoint values against the current AQI table before the pitch.** These are
> the values used for design; do not present them as authoritative without a re-check.

**Why this policy is the hero candidate:** buildings pull in outside air to save cooling energy,
but almost none automatically stop doing that when a hyperlocal ozone or wildfire-smoke PM2.5
spike hits their block. FortyGuard is the only feed providing per-segment ozone + PM alongside
the thermal picture — so the agent can make the *"close the intake, protect the occupants' lungs,
accept a small energy hit"* decision. **That single behavior is the novel, defensible, health-relevant automation.**

---

### 7.4 Policy D — Demand-Response Bid / Battery Dispatch

| | |
|---|---|
| **Actuator** | DR event participation, load-shed depth, battery dispatch schedule |
| **Primary input** | Neighborhood **heat-driven load forecast** across the portfolio's segments |
| **Secondary** | Pre-cool state from Policy A, market price signal |
| **Real-world basis** | FERC Order 2222 aggregation makes per-building resolution newly valuable for portfolios |

**Logic**

```
portfolio_load_forecast = Σ over buildings of f(apparent_temp_forecast[segment], mass, area)

IF   portfolio_load_forecast ≥ DR_BID_TRIGGER
AND  Policy A has successfully pre-cooled ≥ MIN_PRECOOL_FRACTION of the portfolio
THEN bid the aggregate shed capacity, sequenced so the hottest-forecast
     segments shed last and the coolest-forecast segments shed first
```

**Why FortyGuard specifically:** the FERC 2222 aggregation story is *per-building*. Bidding a
portfolio's shed capacity off a single citywide forecast systematically misprices it — some
buildings can shed far more than the average, some far less. **Segment-resolution forecast is
what makes the aggregate bid accurate**, and accuracy in a DR bid is money.

---

## 8. The Conflict Engine — Why an Agent, Not a Threshold

This is the section that converts the sharpest objection into the strongest argument.

### 8.1 The policies genuinely fight

| Conflict | Policy A wants | Policy C wants | Who is right? |
|---|---|---|---|
| Hot **and** smoky | Free-cool with outside air (wet-bulb is favorable) | Close the intake (PM2.5 is unhealthy) | **Depends on magnitudes, occupancy, and forecast** |
| Smoky **and** stuffy | — | Stay closed (smoke outside) | CO₂ is climbing — guidance says bring in outside air during **improved-air-quality windows** to reduce indoor CO₂ |
| Peak beam **and** dark interior | Tint dark (cut cooling load) | — | Lighting load may exceed the cooling savings below the daylight floor |
| DR event **and** heat spike | Shed load (get paid) | — | Shedding into a heat spike risks occupant comfort and thermal runaway |

**No single-sensor rule can arbitrate these.** A PM2.5-only damper controller closes and stays
closed until CO₂ is a problem it cannot see. A thermostat-only controller free-cools straight
through a plume.

### 8.2 Arbitration model

```
Priority order (hard):
  1. Occupant health          → Policy C close-on-smoke wins over energy savings, always
  2. Occupant health, part 2  → CO2 ceiling forces a purge; the agent times it to the
                                cleanest forecast window rather than the next fixed interval
  3. Comfort bounds           → zone temp must stay inside [T_min, T_max] during occupancy
  4. Energy / money           → Policies A, B, D optimize freely inside 1–3
```

The interesting behavior lives in **rule 2**: the agent does not just pick a winner, it uses
the *forecast* to schedule the least-bad moment for the unavoidable action. That is the
difference between arbitration and optimization — and it is only possible with forecast data.

### 8.3 The reframe

> "Ozone and CO₂ pull in opposite directions" is not a flaw in the idea.
> **It is the reason the idea requires an agent.** A threshold cannot weigh smoke-out against
> CO₂-in against cooling-energy across a 12-hour forecast horizon. That weighing *is* the product.

---

## 9. FortyGuard API Call Sequence

### 9.1 The chain

```
 1. Create Heatmap  ──────────▶  async job, returns job handle
        │                        (heatmap-first is the correct sequence — show you know this)
        ▼
 2. Poll / await heatmap  ────▶  segmented grid at 60–100 m
        │
        ▼
 3. Read segment temperature ─▶  identify this building's segment_id
        │                        + surface context (Premium: façade/roof segmentation)
        ▼
 4. Environmental Parameters ─▶  wet-bulb, apparent temp, ozone, PM2.5,
        │                        DNI/DHI, cloud cover — now + 12 h forecast
        ▼
 5. Normalize & persist  ─────▶  de-rate irradiance, align timebase, push to ring buffer
        ▼
 6. DECIDE (§7 policies → §8 arbiter)
        ▼
 7. ACTUATE (simulated BMS) + AUDIT LOG
        ▼
 8. VERIFY (compare intent vs. twin state) ──▶ loop
```

**Demonstrating the async, heatmap-first sequence proves you understand the API** — say this
explicitly in the pitch; it is a cheap, high-signal credibility marker.

### 9.2 Parameter budget by key tier

> **BLOCKING DECISION — see §17.** The call plan differs materially by tier.

**If Premium:**
- Segmentation is available → façade/roof surface context feeds Policy B orientation logic
- All parameters on one call → single fused call per interval per building
- The "full stack, honestly used" claim is fully supported

**If Basic (3-parameter limit):**
Run **two calls per interval** to cover the essential set:

| Call | Parameters | Feeds |
|---|---|---|
| **Call 1** | wet-bulb, PM2.5, DNI | Policies A, C, B — the minimum viable trio |
| **Call 2** | apparent temp, ozone, cloud cover | Policy A refinement, C second pollutant, B de-rating |

Segmentation is unavailable on Basic → substitute façade orientation from static building
metadata (azimuth is a fixed property of the building; it does not need the API). **State this
substitution openly** rather than implying segmentation you do not have.

---

## 10. Control Engineering Rails

These are what make the project read as **real control engineering** rather than a dashboard
with if-statements. Each is cheap to implement and disproportionately credible.

### 10.1 Hysteresis on every threshold

Every threshold has a separate open and close value. No exceptions.
Without this, a parameter oscillating around a single threshold makes the damper chatter and
the setpoint thrash hour to hour — instantly visible, instantly disqualifying.

### 10.2 Asymmetric persistence

Close fast, open slow. A 30-minute sustained trigger closes the intake; a 60-minute sustained
clean reading reopens it. **Use FortyGuard's persistence layer for the "sustained" logic** —
name this in the pitch. The asymmetry encodes a value judgment (protect on the way in, be
skeptical on the way out) and judges recognize it as deliberate.

### 10.3 Clear-sky irradiance must be de-rated by cloud cover

Raw clear-sky DNI drives a west façade to full tint on an overcast day. **De-rate with
`cloud_cover_octas`** before any tint decision. Name this explicitly — it signals you actually
read the parameter list rather than pattern-matching on "irradiance."

### 10.4 Command ≠ motion

> A damper command shown on a control screen does not prove the blades moved.

The verify step logs *intent versus observed state* and flags divergence. In the simulation this
is trivially true, but building it in — and saying it out loud — demonstrates that you know how
real building systems fail.

### 10.5 Pressure relationships are preserved by the BMS, not by us

A smoke response must preserve the building's pressure relationships even when outside air is
adjusted. Commercial buildings have restroom exhaust, kitchen hoods, and elevator shafts —
**they are not large houses.** We emit a *desired* outside-air fraction; the BMS executes it
inside its own pressure and safety interlocks. This boundary is stated in the architecture, not
bolted on when challenged.

### 10.6 Rate limits and command budgets

Cap the number of setpoint changes per hour per actuator. Real operators distrust systems that
move constantly. A budget of, say, 4 changes/hour per actuator forces the agent to spend its
moves on decisions that matter.

---

## 11. The Demo

### 11.1 The scenario

**One building. One hot, smoky afternoon. Real FortyGuard data in, simulated BMS out.**

A single continuous timeline in a US city, replayed at speed:

| Time | Event | Agent action | Parameter that drove it |
|---|---|---|---|
| **11:00** | Forecast shows a 12 h apparent-temp peak | **Pre-cool** — setpoint −2 °F, ramped over 90 min | Forecast wet-bulb / apparent temp |
| **13:00** | Free-cooling window; air is clean | Economizer open, free cooling | Wet-bulb favorable, PM2.5 clean |
| **14:00** | DNI climbs on the west façade | **Auto-tint** west façade to dark | DNI × orientation, de-rated by cloud cover |
| **15:00** | **PM2.5 spike crosses the block** | **Slam the intake shut**, switch to recirculation + high-MERV | PM2.5 crosses Unhealthy, sustained 2 intervals |
| **16:30** | Indoor CO₂ climbing toward ceiling | Agent identifies the **cleanest forecast window** and schedules a timed purge | Forecast PM2.5 + CO₂ estimate |
| **17:00** | Portfolio heat-driven peak | **DR bid** with pre-cooled coast capacity | Segment-level load forecast |

### 11.2 The visual — split screen

```
┌───────────────────────────────┬───────────────────────────────┐
│  ENVELOPE COPILOT             │  STANDARD CONTROLLER          │
│  (FortyGuard-driven)          │  (citywide weather feed)      │
├───────────────────────────────┼───────────────────────────────┤
│  Indoor PM2.5   ▁▁▁▁▁▂▁▁▁     │  Indoor PM2.5   ▁▁▁▃▆█████    │
│  Zone temp      ████▇▇▆▆▇███  │  Zone temp      ███████▇▆▇██  │
│  Cooling kWh    ▁▂▃▄▄▃▂▁      │  Cooling kWh    ▁▂▄▆████▆     │
│                               │                               │
│  ✅ Pre-cooled at 11:00       │  ❌ Reacted at 15:40          │
│  ✅ Intake closed 15:00       │  ❌ Kept inhaling smoke        │
│  ✅ Purge scheduled 18:15     │  ❌ CO₂ unmanaged             │
└───────────────────────────────┴───────────────────────────────┘

              ENERGY SAVED: __%      INDOOR PM2.5 AVOIDED: __%
```

The naive controller keeps pulling in smoke while the copilot holds indoor air quality.
**Every decision on the left traces to a named FortyGuard parameter, shown on hover.**

### 11.3 The rationale panel

Alongside the split screen, a live-scrolling audit log (§6.3). When the 15:00 event fires, the
panel shows the full JSON rationale — inputs, threshold, conflict overridden, cost accepted,
reopen condition. **This panel is the difference between "a demo" and "a system."**

### 11.4 The opening line

> "In July 2026, when wildfire smoke crossed New York, one property manager was asking whether
> to shut every damper while another had already gone full-recirculation — nobody had a signal.
> Meanwhile at 104 °F their economizers were auto-recirculating and starving offices of air.
>
> **Buildings have the controls. What they don't have is an outdoor brain that sees heat, smoke,
> and sun together, per building, before it arrives. That's what we built on FortyGuard."**

---

## 12. Stress Test — Every Objection and the Answer

### 12.1 The five objections, ranked by how much damage they do

| # | Objection | Damage | Answer |
|---|---|---|---|
| **1** | **"Smart buildings already have rooftop AQI sensors. Why FortyGuard?"** | 🔴 **Can sink the pitch** | Three-part answer — see §12.2 |
| **2** | **"Building physics is dangerous to oversimplify."** | 🟠 High | We are a **recommendation-and-command layer feeding the BMS**, which executes inside its own pressure and safety interlocks. We recommend and log; we do not blindly slam dampers. Claiming full autonomous control of real dampers would be the overclaim that gets caught. |
| **3** | **"Ozone and CO₂ pull in opposite directions."** | 🟢 **A gift** | That conflict is *why an agent is needed* rather than a threshold. It weighs smoke-out vs. CO₂-in vs. cooling-energy across a forecast horizon. Guidance literally says to reopen intake during cleaner windows to flush CO₂ — the copilot **times exactly that.** (§8) |
| **4** | **"The actuators already exist — you didn't build anything."** | 🟡 Medium | Correct, and deliberate. We are not building actuators; we are the **outdoor-intelligence layer they lack** — per-building forecast wet-bulb + ozone + PM2.5 + DNI, no hardware, across a whole portfolio. We feed their APIs. Not inventing the machine is the *reason* this adopts fast. |
| **5** | **"Isn't this just the AI building automation 2026 guides already describe?"** | 🟡 Medium | Those optimize on **weather + price** at city resolution. Our differentiator is **input resolution and breadth**: hyperlocal, multi-parameter, *forecast* outdoor data per building — the one thing their generic weather feed gets wrong. |

### 12.2 Objection 1 in full — the one that matters

**The attack:** *"Smart HVAC can already automate damper closure from outdoor-air-quality sensors.
You're rebuilding something that exists."*

This is true and must be conceded immediately. The three-part answer:

**(a) No hardware, across a whole portfolio.**
A reference-grade rooftop AQI sensor is expensive and rare — especially across a portfolio of
dozens of buildings. FortyGuard covers **every** building via API with **zero hardware**. A
40-building portfolio goes from a capital program to an API key.

**(b) Forecast, not just now.**
A physical sensor only reacts *once smoke arrives*. FortyGuard's 12-hour forecast lets the agent
**pre-cool and pre-position before the plume hits** — staging filtration, pre-flushing with clean
air, banking thermal mass. **A reactive sensor structurally cannot do this.**

**(c) The fusion.**
A sensor gives you PM2.5 alone. FortyGuard gives PM2.5 **and** ozone **and** wet-bulb **and** DNI
on the same feed — so **one** agent can arbitrate the heat-versus-air tradeoff instead of two
controllers fighting each other.

**Lead with (a) and (b).** "No hardware across a whole portfolio, plus forecast lead time" is the
compressed version and it is defensible on its own.

---

## 13. Honest Limitations

State these **before a judge asks.** Volunteering limitations is the single highest-leverage
credibility move available in a hackathon pitch.

| # | Limitation | The framing |
|---|---|---|
| **1** | **Simulated actuator.** You cannot wire a real BMS in 3 days. | We built the **decision layer** and emit real setpoint commands into a **digital-twin building**, and we call it a simulation. Judges expect this — pretending otherwise is the failure mode. |
| **2** | **No real occupancy or indoor sensor data.** CO₂ is estimated, not measured. | Stated as a modeled input with its assumptions visible in the audit log. |
| **3** | **Energy savings are modeled, not metered.** | We report a modeled delta against a modeled baseline controller, with the model's assumptions on screen. We never present a modeled number as a measured one. |
| **4** | **US-only, 60–100 m.** | This is a scope statement, not an apology — we anchor the demo in a US city and control at building-block resolution, which is exactly right for one building. |
| **5** | **Thresholds are starting values, not validated setpoints.** | Anchored to EPA AQI breakpoints and common IAQ ceilings so they are externally justifiable, but a real deployment tunes them per building. |
| **6** | **We do not handle pressure relationships, life safety, or fire modes.** | Explicit architectural boundary (§10.5). The BMS owns these. |
| **7** | **Forecast error propagates into pre-cooling decisions.** | Mitigated with headroom margins and by making pre-cooling the *cheapest-to-be-wrong* action (2 °F, occupant-imperceptible). |

---

## 14. 3-Day Build Plan

### Day 1 — Signal and Skeleton

| Block | Deliverable | Definition of done |
|---|---|---|
| AM-1 | FortyGuard client: heatmap → segment → parameters | One building, one timestamp, all target parameters returned and printed |
| AM-2 | Normalization layer | Cloud-cover de-rating implemented and unit-tested; timebase alignment verified |
| PM-1 | Ring-buffer state + persistence logic | Hysteresis and sustained-interval helpers unit-tested against synthetic oscillation |
| PM-2 | Digital-twin building: thermal mass, infiltration, damper mixing, indoor PM2.5 + CO₂ | Twin responds plausibly to a step change in setpoint and damper position |
| **Gate** | **A day of real FortyGuard data replays through the twin end-to-end** | Non-negotiable — if this slips, cut Policy D on Day 2 |

### Day 2 — Policies and Arbitration

| Block | Deliverable | Definition of done |
|---|---|---|
| AM-1 | Policy C (air-quality override) — **build the hero first** | Damper closes on a synthetic PM2.5 spike, reopens asymmetrically, no chatter |
| AM-2 | Policy A (pre-cool) | Setpoint ramps ahead of a forecast peak; twin shows the coast |
| PM-1 | Policy B (tint) with orientation + de-rating | West façade tints at the right hour; overcast day does *not* trigger |
| PM-2 | Arbiter + audit log with full rationale JSON | Hot-and-smoky conflict resolves correctly; CO₂ purge schedules into the cleanest window |
| **Stretch** | Policy D (DR bid) | Cut without hesitation if Day 2 runs long — A/B/C carry the demo |

### Day 3 — Demo, Narrative, Rehearsal

| Block | Deliverable | Definition of done |
|---|---|---|
| AM-1 | Split-screen UI + baseline "citywide weather" controller | Both controllers run the same day; the divergence is visible without narration |
| AM-2 | Rationale panel wired to the audit log | The 15:00 event shows its full JSON on screen |
| PM-1 | Metrics: energy delta, indoor PM2.5 avoided, comfort-hours maintained | Numbers computed from twin state, assumptions displayed |
| PM-2 | **Pitch rehearsal ×3, timed** | Opening line, live demo, objection answers §12 delivered from memory |
| **Gate** | **The 15:00 smoke moment lands in under 20 seconds of demo time** | This is the moment that wins or loses the room |

### Cut list, in order

If time runs short, cut in **exactly** this order — the earlier items protect the core story:

1. Policy D (demand response)
2. Portfolio view (drop to a single building)
3. Ozone as a second pollutant (PM2.5 alone still carries Policy C)
4. Policy B refinements (keep the basic tint, drop the daylight floor)

**Never cut:** Policy C, the rationale panel, the split screen, the honesty rails.

---

## 15. Track Mapping and Scoring Strategy

| Track | Fit | The specific hook |
|---|---|---|
| **06 — Agentic AI** *(primary)* | 🟢 Strong | A genuine closed loop: sense → fuse → decide → actuate → verify, with multi-objective arbitration under conflicting constraints and a forecast horizon. Not a chatbot with tools. |
| **02 — Future Buildings & Energy** | 🟢 Strong | Pre-cooling, coordinated shade–HVAC control, economizer logic, FERC 2222 aggregated DR |
| **07 — Data Analysis & Correlation** | 🟢 Strong | Fusing six parameters across two time bases into a single control decision; the correlation *is* the product |
| **04 — Government & Environment** | 🟡 Angle | The indoor-health framing — occupant respiratory exposure during wildfire-smoke episodes; EPA-anchored thresholds |

**Scoring note:** impact is **40%** of the score. Lead the pitch with the health outcome (occupants
not inhaling smoke) and support with the money outcome (energy saved, DR revenue). Both are real;
health is the one that is felt.

---

## 16. Success Metrics

### 16.1 Demo metrics (modeled, from the twin)

| Metric | Target | How computed |
|---|---|---|
| Indoor PM2.5 exposure avoided | ≥ 50 % vs. baseline | ∫(baseline indoor PM2.5 − copilot indoor PM2.5) dt over the smoke window |
| Cooling energy delta | ≤ +10 % during override, net ≤ 0 % over the day | Pre-cool savings offsetting the recirculation penalty |
| Comfort hours maintained | ≥ 95 % of occupied hours inside [T_min, T_max] | Twin zone-temperature trace |
| Setpoint changes per actuator per hour | ≤ 4 | Audit log count — proves the hysteresis works |
| Decisions with a complete rationale | **100 %** | Audit-log schema validation |

### 16.2 Judging metrics

| Signal | Evidence |
|---|---|
| Full stack genuinely used | Four actuators, four different parameter slices (§ Appendix A) |
| API understood | Async heatmap-first sequence demonstrated (§9.1) |
| Real control engineering | Hysteresis, asymmetric persistence, rate limits, cloud de-rating (§10) |
| Intellectual honesty | Limitations volunteered before being asked (§13) |
| Defensible differentiation | Objection 1 answered in three parts without hesitation (§12.2) |

---

## 17. Open Decisions — BLOCKING

> These two answers change the architecture. Everything above is written to accommodate either
> branch, but Day 1 cannot start cleanly until both are locked.

### 🔒 Decision 1 — Is the FortyGuard key **Basic** or **Premium**?

| | Premium | Basic |
|---|---|---|
| Segmentation | ✅ Available → façade/roof surface context feeds Policy B | ❌ Substitute static building azimuth metadata |
| Parameters | All on one call | 3 per call → **two calls per interval** (§9.2) |
| Recommended trio if Basic | — | **wet-bulb, ozone-or-PM2.5, irradiance** |
| Impact on pitch | "Full stack, honestly used" fully supported | Same claim, with the substitution stated openly |

### 🔒 Decision 2 — Which actuator is the demo's **hero**?

| Option | Case for it | Case against |
|---|---|---|
| **C — Smoke-intake safety override** | Most novel; health story; tied to the real July 2026 event; nobody automates it; the 15:00 moment is the most cinematic beat available | Energy story becomes supporting rather than lead |
| **A + D — Pre-cool + demand response** | Most money; FERC 2222 tailwind; the buyer's existing budget line | Closer to what existing DR vendors already sell — weaker novelty claim |

**Recommendation: hero = Policy C (smoke override), with A/B/D as the supporting energy narrative.**
Rationale — impact is 40 % of the score, health is felt more immediately than kWh, the novelty
claim is strongest there, and it is the policy anchored to a real, dateable, human event. The
energy story then arrives as *"and it pays for itself"*, which is a stronger sequence than the reverse.

### Once both are locked, the next document produces:

- [ ] Full architecture spec with module boundaries and interfaces
- [ ] The four decision policies as implementable pseudocode with final thresholds and hysteresis bands
- [ ] Exact FortyGuard call sequence with request/response shapes for the chosen tier
- [ ] Simulated-BMS digital-twin specification (thermal mass, mixing, PM2.5/CO₂ dynamics)
- [ ] Demo script, beat by beat, with timings
- [ ] Hour-by-hour 3-day plan with the cut list wired to real checkpoints
- [ ] Track submission text for 02 / 04 / 06 / 07

---

## Appendix A — Parameter → Actuator Matrix

**This table is the entire argument for why the project needs the full FortyGuard stack.**
Read down the columns: no actuator shares a primary driver with another.

| FortyGuard parameter | Policy A<br>Pre-cool | Policy B<br>Tint | Policy C<br>Damper | Policy D<br>DR bid |
|---|:---:|:---:|:---:|:---:|
| **Wet-bulb temperature** | 🔵 **Primary** | — | 🟡 Secondary<br>*(free-cooling availability)* | 🟡 Secondary |
| **Apparent temperature** *(forecast)* | 🔵 **Primary** | — | — | 🔵 **Primary** |
| **Ozone (O₃)** | — | — | 🔵 **Primary** | — |
| **PM2.5** | — | — | 🔵 **Primary** | — |
| **DNI** *(direct beam)* | 🟡 Secondary | 🔵 **Primary** | — | 🟡 Secondary |
| **DHI** *(diffuse)* | — | 🟡 Secondary | — | — |
| **Cloud cover (octas)** | 🟡 Secondary | 🔵 **Primary**<br>*(de-rating)* | — | 🟡 Secondary |
| **Segmentation** *(Premium)* | 🟡 Secondary<br>*(thermal context)* | 🔵 **Primary**<br>*(façade orientation)* | 🟡 Secondary | 🔵 **Primary**<br>*(portfolio aggregation)* |
| **Forecast horizon (12 h)** | 🔵 **Primary** | 🟡 Secondary | 🔵 **Primary**<br>*(pre-positioning)* | 🔵 **Primary** |

**Legend:** 🔵 Primary — the decision cannot be made without it · 🟡 Secondary — materially improves the decision

**The claim this table supports:** every parameter is load-bearing for at least one actuator, and
no two actuators are driven by the same primary. That is what "uses the full stack honestly"
means, and it is checkable at a glance.

---

## Appendix B — Research Provenance

**Verification pass completed 29 Aug 2026.** Every row below was re checked against a live source on
that date. Sources are linked. Three claims changed, one constant does not have the backing we
assumed, and one competitor no longer exists as an independent company.

### Verified

| Claim | Status | Source |
|---|---|---|
| PM2.5 24 h AQI 151 (Unhealthy) begins at **55.5 µg/m³** | ✅ exact match to our constant | [EPA AQS breakpoints](https://aqs.epa.gov/aqsweb/documents/codetables/aqi_breakpoints.html) |
| Ozone 8 h AQI 151 begins at **0.086 ppm (86 ppb)** | ✅ exact match to our constant | [EPA AQS breakpoints](https://aqs.epa.gov/aqsweb/documents/codetables/aqi_breakpoints.html) |
| BrainBox AI learning period is **6 to 8 weeks**; install 2 to 3 hours | ✅ as stated | [UKGBC](https://ukgbc.org/resources/autonomous-ai-hvac-optimisation/), [BrainBox AI](https://brainboxai.com/en/solutions/ai-control) |
| BrainBox AI deployed in **14,000+ commercial buildings** | ✅ | [Facilities Dive](https://www.facilitiesdive.com/news/trane-technologies-agrees-to-acquire-brainbox-ai/736155/) |
| Parity: **200+ buildings, 65M sq ft**, Toronto, NYC, Boston, DC; condos, co ops, rentals, hotels | ✅ | [Parity](https://www.paritygo.com/) |
| Parity charges **no upfront cost**, contractually guaranteed savings | ✅ | [Parity](https://www.paritygo.com/actual-savings-on-your-utility-bill/) |
| Runwise controls **boilers and central heating** in multifamily; our actuators are absent there | ✅ confirms Correction 1 in [who-we-build-for.md](docs/decisions/product/who-we-build-for.md) | [Runwise FAQ](https://www.runwise.com/faq) |
| Manual point mapping is **30 to 40% of BMS integration labour** | ⚠️ verified only to a consultancy blog, not a primary study | [ASDV](https://www.asdvconsultant.com/blog/open-protocol-bacnet-knx-modbus-integration) |
| FERC Order 2222 (17 Sep 2020) opens RTO/ISO wholesale markets to **DER aggregations** | ✅ | [FERC fact sheet](https://www.ferc.gov/media/ferc-order-no-2222-fact-sheet) |
| 300 lux is a standard daylight and office task target | ✅ supports `DAYLIGHT_FLOOR_LUX` | [EN 17037 via ClimateStudio](https://climatestudiodocs.com/docs/daylightEN17037.html) |

### Corrected

| Was | Now | Source |
|---|---|---|
| Runwise "7,500 buildings" | **Their FAQ says 7,500 across the Northeast. CNBC, Aug 2025, says 10,000+ buildings across 10 states with ~1,000 customers.** Cite whichever, but say which. | [Runwise FAQ](https://www.runwise.com/faq), [CNBC](https://www.cnbc.com/2025/08/09/real-estate-startup-runwise-cre-heating-cooling.html) |
| Parity "50,000+ units" | **Not confirmed.** The verifiable figures are 200+ buildings and 65M sq ft. Do not say units. | [Parity](https://www.paritygo.com/) |
| BrainBox "20 countries" | **Not confirmed.** 16 countries was the 2020 figure. Say "global" or cite the building count instead. | [BrainBox 2020 release](https://brainboxai.com/en/newsroom/rapid-global-adoption-of-ai-driven-building-solution-brainbox-ai-expands-to-16-countries-across-5-continents-in-2020) |

### Material change to the competitive landscape

**Trane Technologies agreed to acquire BrainBox AI on 20 December 2024, closing early 2025.**
BrainBox is now part of the largest HVAC manufacturer, and its technology is being integrated into
Trane's Tracer SC+ building automation system.

This cuts both ways and should be said plainly rather than avoided: it validates that the category
is real enough for an OEM to buy into, and it means the nearest competitor now has OEM distribution
and an install base we cannot match. Our argument does not depend on out resourcing them — it
depends on delivering value **before** the gateway, which is a sequencing advantage, not a funding
one.

Source: [Facilities Dive](https://www.facilitiesdive.com/news/trane-technologies-agrees-to-acquire-brainbox-ai/736155/)

### Failed verification — a constant we cannot justify

**`CO2_HARD_PPM = 1500` does not trace to a standard.**

ANSI/ASHRAE 62.1-2022 recommends a steady state indoor CO₂ concentration no greater than **700 ppm
above outdoor**, and outdoor air is typically 300 to 500 ppm — an indoor ceiling of roughly **1000
to 1200 ppm**. Our `CO2_CEILING_PPM = 1100` sits inside that. **Our 1500 ppm hard limit sits above
it and has no source.**

ASHRAE is also explicit that these values exist to set demand controlled ventilation setpoints and
**"should not be used as indicators of indoor air quality."** Any copy describing CO₂ as an air
quality measure is wrong, including ours.

Source: [ASHRAE position document on indoor carbon dioxide](https://www.ashrae.org/file%20library/about/position%20documents/pd-on-indoor-carbon-dioxide-english.pdf),
[ASHRAE public policy brief](https://www.ashrae.org/file%20library/about/government%20affairs/public%20policy%20resources/briefs/indoor-carbon-dioxide-ventilation-and-indoor-air-quality_2023.pdf)

### Also unresolved

**ASHRAE 90.1 economizer high limit does not have a fixed dry bulb value for climate zone 4A**, which
is New York City. The published table lists 4B and 4C at 75 °F and omits 4A, meaning fixed dry bulb
is not the permitted control type there. Do not cite a dry bulb changeover figure for NYC.

Source: [UpCodes, economizer high limit shutoff](https://up.codes/s/economizer-high-limit-shutoff)

**Still unsourced, and therefore not to be spoken as fact:** the July 2026 Westchester smoke advisory
narrative, the "three property managers, three damper decisions" anecdote, the claim that default
economizer logic starves fresh air at 104 °F, and the electrochromic prior art. These were carried
from the original concept pass and none of them survived as citable. They are removed from the pitch
rather than softened.

> **Standing rule.** A number reaches a judge only with a link in this table. Citing a fact you
> cannot produce a source for is worse than not citing it.

## Appendix C — Glossary

| Term | Meaning |
|---|---|
| **Apparent temperature** | What the heat *feels* like, combining temperature, humidity, and wind — the right input for occupant comfort and load |
| **BMS** | Building Management System — the software that already runs HVAC, lighting, and dampers; our command target |
| **DHI** | Diffuse Horizontal Irradiance — sky-scattered light, not directional |
| **DNI** | Direct Normal Irradiance — the direct solar beam; the decision-relevant number for façade heat gain |
| **DR** | Demand Response — shifting or shedding load on a utility signal, in exchange for compensation |
| **Economizer** | The control mode that uses cool outside air for "free cooling" instead of mechanical refrigeration |
| **Electrochromic glass** | Glass that changes tint on an electrical signal — a digital, API-addressable actuator |
| **FERC Order 2222** | The ruling that opened wholesale energy markets to *aggregated* distributed resources — why portfolios matter |
| **Hysteresis** | Separate on/off thresholds, so a signal oscillating near a boundary does not cause the actuator to chatter |
| **MERV** | Filter efficiency rating — higher blocks finer particles, at the cost of airflow and fan energy |
| **Octas** | Cloud cover in eighths of the sky — the de-rating input for clear-sky irradiance |
| **Segment** | A 60–100 m cell in FortyGuard's spatial grid — the resolution at which we control |
| **Wet-bulb temperature** | The temperature accounting for evaporative cooling — determines whether free cooling is physically available, and the true limit of human heat tolerance |

---

*Document status: scaffold complete, pre-build. Two blocking decisions in §17.*
