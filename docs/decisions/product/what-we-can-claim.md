# Decision — What we can claim

**Status:** locked · **Product law.** Supersedes any earlier positioning in [`../../../idea.md`](../../../idea.md).

Live probing on 27 Aug 2026 disproved part of the original thesis. Evidence and method:
[`../../reference/fortyguard/api.md`](../../reference/fortyguard/api.md), "Resolution limits".

## Never say

| ❌ | Why it is false |
|---|---|
| "Hyperlocal PM2.5" or "ozone at 60 metres" | Air quality is **metro scale**. Midtown Manhattan and Newark, 15 km apart, returned an identical 156 AQI in the same hour. |
| "Your segment reads X while the citywide average is Y" *(air quality)* | Both numbers are the same. This was the original hero visual and it was a fabrication. |
| "The plume crosses your block at 15:00" | PM2.5 is a **daily** value. On the 2023 wildfire day it read 156.2 at 08:00 and 156.1 at 20:00. |
| "Forecast wet bulb **and ozone and PM2.5** at 60 m" | Only the thermal half of that sentence is true. |

## Say instead

| ✅ | Evidence |
|---|---|
| **Temperature is genuinely per block.** 4265 distinct tiles across 23 mi²; **2.8 °F between the hottest and coolest block in the same minute**. | Wide heatmap probe, 2026-07-18 15:00 |
| **A twelve hour forecast per building.** A rooftop sensor is reactive by construction; this is not. | Vendor ceiling, confirmed |
| **Ozone varies hour to hour**, so "wait for the cleanest hour ahead" is a real decision, not a simulated one. | 36.4 → 79.8 → 40.5 across one day |
| **Nobody automates the intake on air quality**, and the tradeoff against CO₂ and cooling energy still needs an agent. | Unchanged by the finding |

## The reframed thesis

> Buildings already have the controls. What they lack is **foresight**, and a **thermal picture of
> their own block**. Envo supplies both, and arbitrates the conflict they create.

Hyperlocality now supports the **heat** story (pre cool, tint). The air quality override survives
intact and stays the hero, because its value was never that the plume was hyperlocal — it was that
**no building automatically closes its intake on air quality at all**, and that doing so fights
CO₂ and free cooling in a way only an agent can weigh.

## The demo consequence

The split screen still compares against a citywide weather baseline, but the divergence it shows is
**thermal and forecast driven**, not a plume that only one building sees. The baseline fails because
it cannot see the peak coming and cannot see its own block's temperature, not because it is blind to
a local plume.
