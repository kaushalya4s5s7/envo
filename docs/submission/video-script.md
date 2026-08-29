# Video script — 3:00

Submission requires 2 to 5 minutes. This runs 3:00 with room to breathe.

**Rules for the recording.** Every number spoken is on screen at the same moment. Nothing is
mocked — all four screens are the real app reading real captured data. Do not say "could" or
"imagine": if it is not built, it is not in the video.

**Before you record:** `bun run dev`, open `/`, `/onboarding`, `/app`, `/replay` in tabs. Have
`docs/reference/fortyguard/api.md` and a terminal with `bun test` ready.

---

## 0:00 – 0:22 · The problem

**Screen:** `/` hero. The pixel heatmap fills the frame.

> "At 104 degrees, a commercial building's economizer recirculates to save cooling energy and
> starves the offices of fresh air. When smoke crosses the city, the same damper stays open and the
> building inhales it.
>
> The lever fails in both directions for one reason. The controller runs on a single citywide
> weather feed. It cannot see outside its own façade."

---

## 0:22 – 0:50 · What is actually different at 60 metres

**Screen:** hero heatmap. Cursor traces two tiles that are visibly different colours.

> "This is one real FortyGuard heatmap of Manhattan. Fifteen hundred blocks, and they span one point
> three degrees Fahrenheit at the same minute. Across a wider grid it is two point eight.
>
> Your building automation system gets one number for all of them.
>
> We checked whether air quality does the same thing. It does not. Midtown and Newark, fifteen
> kilometres apart, returned an identical index in the same hour. So we claim hyperlocal heat, and
> we say plainly that air quality is metro scale. That correction cost us our original pitch."

**Why this beat:** it establishes the product *and* establishes that we test our own claims, in
twenty-eight seconds.

---

## 0:50 – 1:28 · The product

**Screen:** `/onboarding`, click through all four steps at pace.

> "Every product in this category installs a gateway, maps thousands of BMS points by hand, then
> learns your building for six to eight weeks before it says anything.
>
> Ours starts with an address. You point at your own block on the real heatmap — that is the segment
> binding, and it is your decision, not our guess.
>
> We never ask for a setpoint. Assuming one cost us forty-one percent more energy against an
> independent emulator, so it gets read from the building later."

**Screen:** cut to `/app`.

> "Then this is the whole product at seven fifteen on a Tuesday. Today peaks at a hundred and three
> around six. Air quality turns at eleven. One thing to act on.
>
> Every row carries the reading that caused it and the condition that reverses it — because the
> person reading this is often a contractor who has to justify it to a client."

---

## 1:28 – 2:06 · The agent, and the rails

**Screen:** `/replay`, scroll to the agent panel.

> "Track six is agentic AI, so here is the agent doing actual work. Gemini arbitrates where our
> policies conflict, and it wrote this summary of the day. Every figure in it traces back to the
> captured fixture — we checked all four.
>
> But it proposes. It does not drive."

**Screen:** scroll to the RECORDED INCIDENT block. Let it sit for two full seconds.

> "On its first live call, this model proposed a setpoint of seven hundred and forty degrees.
>
> The comfort rail refused it and wrote down why. That is not staged — it is a real incident from a
> real call, and it is the only honest evidence that the rails work.
>
> Four rails: contract, rate limit, comfort bounds, and health priority. The model earns the wheel
> in shadow first, the same way a new operator does."

---

## 2:06 – 2:48 · What happened when we scored ourselves honestly

**Screen:** terminal, `docs/decisions/platform/sandbox-findings.md` open beside it.

> "Last thing, and it is the part we are most proud of.
>
> Our own simulator said we saved twenty-six percent. We did not trust it, because we wrote it. So we
> ran the same agent against BOPTEST — the building emulator from IBPSA and the US Department of
> Energy — and let physics we did not write do the scoring.
>
> It said we were using twice the energy.
>
> That gap exposed five real defects. Two were in our own physics model. One was a CO2 purge that
> could defer forever, which we only found because a lower threshold changed nothing at all.
>
> After fixing them: on a real captured day, we cut operating cost three point nine percent against
> the emulator's own controller, by shifting load off peak-price hours. We still use more energy, and
> we say so on the page."

---

## 2:48 – 3:00 · Close

**Screen:** back to `/` hero.

> "Buildings already have the actuators. What they lack is foresight and a thermal picture of their
> own block — both pure software on infrastructure that is already installed.
>
> We would rather ship a three point nine percent number we can defend than a twenty-six percent one
> we cannot."

---

## What to have on screen, by beat

| Time | Screen | The one thing that must be legible |
|---|---|---|
| 0:00 | `/` | the heatmap |
| 0:22 | `/` | `1,501 blocks spanning 1.3 °F` |
| 0:50 | `/onboarding` | the tile grid at step 2 |
| 1:10 | `/app` | the headline sentence |
| 1:28 | `/replay` | the agent turn table |
| 1:50 | `/replay` | **`setpointF: 740.0000000000001`** |
| 2:06 | terminal | the BOPTEST variant table |
| 2:48 | `/` | headline |

## Lines to cut first if you run long

1. The Newark comparison at 0:40 (keep "air quality is metro scale")
2. The setpoint / forty-one percent aside at 1:20
3. The five-defects detail at 2:30 (keep "two were in our own physics model")

## Do not say

- "Revolutionary", "seamless", "next generation"
- Any number not visible on screen at that moment
- "Saves energy" — we do not. Say **cost**.
- "Hyperlocal air quality" — disproved, and a judge can check in one API call
