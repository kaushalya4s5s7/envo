# Flow — Decision loop

One pass per 15-minute interval, per building, per strategy.

```
 fixtures/<scenario>.json
        │
        ▼
 1 SENSE     core/weather  replay source → raw vendor rows
        │                          (live source only ever used for capture)
        ▼
 2 FUSE      core/weather  normalize units → align timebase → EnvSnapshot
        │                          + solar: projectBeamOntoFacade → derateForCloud
        ▼
 3 STATE     core/copilot        carry latches between intervals → hysteresis + persistence
        │
        ▼
 4 DECIDE    core/policies       precool | tint | airQuality | demandResponse
        │                          each pure: (state) => Proposal[]
        ▼
 5 ARBITER   core/copilot        priority 1..4 → Command[] + DecisionRecord[]
        │                          rationale populated or it is a test failure
        ▼
 6 ACTUATE   core/bms            rate-limit → simulated adapter → twin input
        │
        ▼
 7 STEP      core/twin           thermal mass · damper mixing · indoor PM2.5 · CO₂
        │
        ▼
 8 VERIFY    core/bms            intent vs. observed twin state → flag divergence
        │
        └──▶ append interval to RunArtifact ──▶ loop
```

## FortyGuard call chain (capture path only)

```
Create Heatmap ──▶ async job handle
       ▼
Poll / await ─────▶ segmented grid @ 60–100 m
       ▼
Read segment ─────▶ segment_id for this building (+ surface context on Premium)
       ▼
Environmental Parameters ──▶ wet-bulb, apparent temp, ozone, PM2.5, DNI/DHI,
                             cloud cover — now + 12 h forecast
       ▼
write fixtures/<scenario>.jsonl
```

Heatmap-first and async is the correct sequence for capture. Replay starts from the committed
fixture and never contacts FortyGuard.

## Both strategies, one loop

`copilot` runs steps 3–8 twice per interval with two strategies against two independent twin instances:

| Strategy | Signal |
|---|---|
| `envelopeCopilot` | Full `EnvSnapshot` — segment-level, multi-parameter, 12 h forecast |
| `baseline` | Degraded snapshot: current conditions with flattened metro AQI, no forecast |

Same loop, same twin, same thresholds. **Only the signal differs.** That is the honest comparison.
