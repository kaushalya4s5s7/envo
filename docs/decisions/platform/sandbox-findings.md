# Sandbox findings — the agent lost to an independent baseline

> **Update, 29 Aug 2026.** Two defects in the harness itself were found and fixed, and the
> experiment was re run. See [Re run, 29 Aug](#re-run-29-aug-2026) at the foot of this file — the
> comparison this document was built on was **not measuring what it claimed to**.

**28 Aug 2026.** First honest scoring of our agent by physics we did not write.
Emulator: BOPTEST `multizone_office_simple_air`, `peak_cool_day`, hourly, 17 h.
Signal: real captured FortyGuard day `demo-nyc-001-2026-08-07`.

## The result

| Variant | What it drives | `ener_tot` | `tdis_tot` | `idis_tot` |
|---|---|---|---|---|
| **builtin** | nothing — BOPTEST's own controller | **0.0998** | 0.38 | **7.19** |
| **no-setpoint** | sealing only | 0.0909 | 0.39 | 1763.76 |
| **no-seal** | setpoint only | 0.2076 | **0.00** | **0.00** |
| **asis** | both | 0.1971 | 0.00 | 1578.54 |
| **co2-800** | both, ceiling 1100 → 800 | 0.1971 | 0.00 | 1578.54 |

Our own twin reported **26.1% savings** on this day. BOPTEST reports **2× the energy**.
The twin was flattering us because we wrote it. That is the entire reason the sandbox exists.

## 1. Policy bug — confirmed

**`co2-800` is byte identical to `asis`.** Lowering the CO₂ ceiling by 300 ppm changed nothing at
all, which proves the ceiling is **not the binding constraint**.

The hourly trace shows why. Sealing engages at hour 12 on ozone AQI 151. CO₂ then climbs about
230 ppm per hour:

```
hr 12  sealed      763 ppm
hr 14             1179   ← ceiling crossed
hr 16             1622   ← purge finally fires, 2 h late and 500 ppm over
```

Two defects in `airQualityPolicy`:

1. **The purge is gated on the wrong pollutant.** It searches the forecast for the cleanest
   **PM2.5** hour, but the seal was triggered by **ozone**. It waits for clean particulates while
   ozone is the hazard.
2. **"Wait for the cleanest window" has no deadline.** PM2.5 declined monotonically that day, so a
   cleaner hour was always forecast ahead and "now" was never cleanest. The purge deferred until the
   forecast ran out at hour 16 and `cleanest === null` made the condition trivially true.

[`../product/arbitration.md`](../product/arbitration.md) defines the CO₂ ceiling as a **health
priority that outranks energy**. As implemented it is advisory. That is a contradiction of product
law, not a tuning choice.

## 2. Tuning problem — confirmed

**Driving the setpoint is the entire energy loss.** `no-seal` alone costs 0.2076 against builtin's
0.0998, so our setpoint control roughly **doubles** consumption on its own.

It buys perfect comfort — `tdis_tot` 0.00 against 0.38 — by holding the zone at 72 °F where the
built-in controller runs 75.2 °F. That is not optimization, it is **over cooling by three degrees**.

Root cause: `COMFORT.SETPOINT_F = 72` is **our assumption**, not this building's setpoint. A DOE
medium office runs warmer. We are driving a building to a target it was never designed to hold.

**Product consequence:** the nominal setpoint must come from the building's existing schedule, read
during the shadow phase of [`../../flows/product-flow.md`](../../flows/product-flow.md). It cannot
be a constant in our code. This is a real finding about the product, not only about a threshold.

## 3. Fundamentally bad strategy — not established

Two mechanisms defend the strategy:

- **Sealing saves energy.** `no-setpoint` at 0.0909 beats builtin's 0.0998 — about **9% less**,
  which is what closing outside air on a hot day should do.
- **The coast works.** Hourly energy drops 3 to 4× the moment the coast engages
  (0.0200 → 0.0052 kWh/h). The mechanism is sound; the charge is too deep and too long to pay for it.

## The metric boundary, stated honestly

`idis_tot` is driven by **CO₂**. It has no knowledge of outdoor ozone, so it cannot see the exposure
our seal prevents — `no-seal` scores a perfect 0.00 precisely because nothing else moves it.

That is a real limitation of the benchmark and it belongs in the pitch as a stated boundary, **not**
as a defence. Our seal still drove CO₂ to 1622 ppm, and that number is real regardless of what the
metric was designed to capture.

## What changes

| Change | Kind |
|---|---|
| Purge must consider the pollutant that caused the seal, not only PM2.5 | Bug fix |
| The CO₂ ceiling must be a hard deadline, not a preference deferred by a search for a better window | Bug fix, restores `arbitration.md` priority 2 |
| Nominal setpoint must be read from the building, not assumed | Product change |
| Pre cool charge depth and duration need tuning per building | Tuning |

## What must not change yet

**No pitch copy, [`docs/idea.md`](../../idea.md), or landing page edits until the fixes above are made and re scored.**
The current numbers measure a broken purge and a wrong setpoint, not the strategy.


---

## Re run, 29 Aug 2026

### Two defects in the harness, not the agent

**1. The `citywide` arm was never controlling anything.** It left its setpoint and damper unset, so
with a degraded signal no policy ever fired and every point stayed with BOPTEST. It came back
**identical to `builtin` to four decimals on every KPI**. The headline "same loop, only the signal
differs" was therefore comparing our loop against *no control at all*. Both controlled arms now
engage their actuators from the first hour, so the actuator set is constant and the comparison
isolates the one thing it claims to.

**2. A signed percentage was printed as if it were a saving.** The old output read
`energy -97.5%` under a "copilot vs citywide" heading for a run that used 97.5% **more** energy.
Direction is now stated in words, and every KPI is shown rather than energy alone.

A third, smaller one: `damper < NORMAL_OA_FRACTION` counts `null` as reduced, because `null < 0.2`
is true in JavaScript. That would have reported the untouched builtin arm as reduced every hour.

### The result, with the comparison actually working

| | builtin | citywide | copilot |
|---|---|---|---|
| energy `ener_tot` | **0.0998** | 0.1965 | 0.1865 |
| cost `cost_tot` | **0.0103** | 0.0165 | 0.0169 |
| thermal `tdis_tot` | 0.38 | **0.00** | **0.00** |
| air quality `idis_tot` | **7.19** | 1613.69 | 1326.27 |
| hours on reduced intake | 0 | 0 | 3 |
| max zone °F | 77.2 | 73.3 | 73.9 |

**Copilot against citywide — the same actuators, only the signal differs:**

| | |
|---|---|
| energy | **5.1% less** |
| air quality discomfort | **17.8% less** |
| cost | 2.3% more |
| peak electrical | 10.3% more |

This is the comparison the product's claim actually rests on, and it now holds up under scoring we
did not do: the hyperlocal signal is worth 5.1% of cooling energy and 17.8% of air quality
discomfort, on identical hardware and an identical loop. Copilot took **10 decisions** across the
day against citywide's 4.

**Copilot against BOPTEST's own controller: we still lose.** Energy 86.9% more, cost 63.6% more,
air quality far worse. We win thermal discomfort outright, 0.00 against 0.38. We buy comfort with
energy, and that tradeoff is stated on `/app/sandbox` rather than hidden.

### New finding — our nominal outside air fraction under ventilates

The air quality gap is **not** caused by the sealing policy, which was the previous assumption.

The `citywide` arm **never reduced intake at all** — it held `NORMAL_OA_FRACTION` for all 17 hours —
and still scored `idis_tot` 1613.69 against builtin's 7.19, with CO₂ reaching **1408 ppm against
builtin's 918**.

So the cause is the constant itself: **`AIR.NORMAL_OA_FRACTION = 0.2` is too low for this
archetype.** BOPTEST's own controller ventilates considerably harder. This is ours, it traces to
[`thresholds.md`](../product/thresholds.md), and no amount of policy tuning fixes it.

This is the second time the emulator has found a defect in our constants that our own twin could
not — the first being CO₂ ramping at 547 ppm/h against BOPTEST's 230. That is the argument for the
sandbox existing.

**Not yet fixed.** Changing a ventilation constant is a comfort and health decision, not a tuning
knob, and it needs a standard behind it rather than a number that makes our score better.
