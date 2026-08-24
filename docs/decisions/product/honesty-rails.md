# Decision — Honesty rails

**Status:** locked · **Product law.** These are pitch-critical. Violating one costs more than any feature gains.

## Control engineering — required in code

| # | Rail | Enforcement |
|---|---|---|
| 1 | **Hysteresis on every threshold** | Separate open/close values via `core/utils` helper. No single-threshold compare in `policies`. |
| 2 | **Asymmetric persistence** | Close fast (2 intervals), open slow (4). Encodes: protect on the way in, be skeptical on the way out. |
| 3 | **Cloud de-rating before any tint decision** | `derateForCloud(beam, octas)` is mandatory in Policy B. Raw clear-sky DNI tints a west façade on an overcast day. |
| 4 | **Command ≠ motion** | `bms` verify step logs intent vs. observed twin state and flags divergence. Trivially true in sim — build it anyway; it shows you know how real buildings fail. |
| 5 | **Pressure relationships are the BMS's job** | We emit a *desired* outside-air fraction. The BMS executes inside its own interlocks. Architectural boundary, not a disclaimer. |
| 6 | **Rate limits** | `MAX_CHANGES_PER_HOUR` per actuator, enforced in `bms`. |

## Claims — never make these

| Never say | Say instead |
|---|---|
| "We control the building" | "We are the outdoor brain the existing controllers are missing" |
| "We saved X% energy" | "Our model shows X% against a modeled baseline, assumptions on screen" |
| "Indoor CO₂ was 1100 ppm" | "CO₂ is estimated by our twin, not measured" |
| "We integrate with BMS" | "We emit BMS-shaped commands into a digital twin — this is a simulation" |
| Any research claim without a live source link | Cite it or drop it (see `idea.md` Appendix B) |

## Volunteer limitations before being asked

Simulated actuator · CO₂ and occupancy modeled, not measured · energy modeled, not metered · US-only 60–100 m · thresholds are starting values · no pressure/life-safety/fire handling · forecast error propagates into pre-cool.

Every modeled number rendered in `console` displays its assumptions inline. Not in a tooltip. On screen.
