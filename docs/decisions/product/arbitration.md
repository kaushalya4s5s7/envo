# Decision — Arbitration

**Status:** locked · **Product law.**

Policies propose; they never actuate. The arbiter in `core/copilot` resolves conflicting `Proposal[]` into one `Command[]`.

## Priority order — hard

| # | Rule | Beats |
|---|---|---|
| 1 | **Occupant health — smoke/ozone** | Policy C close-on-smoke wins over energy savings, always |
| 2 | **Occupant health — CO₂** | `CO2_CEILING` forces a purge; the agent **schedules it into the cleanest forecast window**, not the next fixed interval |
| 3 | **Comfort bounds** | Zone temp stays inside `[T_MIN_F, T_MAX_F]` during occupancy |
| 4 | **Energy / money** | A, B, D optimize freely inside 1–3 |

## The behavior that matters

Rule 2 is the differentiator. The agent does not pick a winner — it uses the **forecast** to schedule the least-bad moment for an unavoidable action. That is arbitration, not optimization, and it is impossible without forecast data.

If Rule 2 is implemented as "purge at a fixed interval," the demo has lost its strongest moment.

## Known conflicts the arbiter must handle

| Situation | Resolution |
|---|---|
| Hot **and** smoky | C closes the damper; A absorbs the load via pre-cooled thermal mass; the energy cost is **logged, not hidden** |
| Smoky **and** stuffy | Hold closed; schedule purge into the cleanest forecast window (Rule 2) |
| Peak beam **and** dark interior | Tint stops at `DAYLIGHT_FLOOR_LUX` — lighting load would exceed cooling savings |
| DR event **and** heat spike | Shed only within comfort bounds; hottest-forecast segments shed **last** |

## Every command carries its rationale

No `Command` leaves the arbiter without a populated `DecisionRecord`: inputs, policy fired, threshold crossed, sustained count, conflicts overridden, cost accepted, benefit, reopen condition, plain-language rationale. Schema in `core/contracts`.

**A command with an empty rationale is a failed test, not a warning.** This field is what makes the system read as an agent rather than a threshold script, and it is what the judge reads on screen.
