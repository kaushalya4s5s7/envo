# Demo script

No fixed runtime. Every number here is on screen when you say it. Nothing is claimed that the
build does not do.

Speak slowly. Pause after each number. When there is room to go deeper — a technical judge, an
investor doing diligence, anyone who asks "how does that actually work" — the sections below the
spoken lines exist for exactly that. Read the blockquotes for the fast pass; read the paragraphs
under them when someone wants the mechanism, not just the headline.

---

## Part 1 — The problem. Landing page.

> "Every building in a city gets the same weather forecast. One number, for the
> whole metro."
>
> "But this is a real heatmap of Manhattan, from FortyGuard. Four thousand two
> hundred and sixty five blocks. Two point eight degrees between the hottest and
> the coolest, **at the same minute**."
>
> "Your building automation system gets one number for all of them. So it reacts
> to heat after it arrives, every single day."

Scroll slowly through **How it works** while you say the last line. Do not read
the four steps aloud.

---

## Part 2 — Sign in, then the address. Step 1.

Click **Sign in**, then Google. While the dashboard loads:

> "Two buildings here. One is live. The other is a real building, and it is greyed
> out, because we do not have a driver for real equipment yet. I will come back
> to that."

Open step one. Type a real address. Pick from the list.

> "No hardware. No site visit. No access to anyone's building system. Just an
> address."

When the map appears, stop talking for a second and let it land.

> "That is their block, on a real street map. Every square is a real FortyGuard
> measurement. The ring is the building."
>
> "This took about twenty five seconds. The full read takes two minutes."
>
> "Those two minutes are two live calls to FortyGuard, for this exact block — a
> heatmap read, then twelve hours of the parameters our policies actually use.
> Nothing you are about to see was cached or replayed."

---

## Part 3 — The morning screen.

> "This is the product. Not a dashboard. One screen, in the morning."
>
> "Each line says what to do, the reading that caused it, and what would make you
> undo it. Because the person reading this often manages buildings under contract,
> and has to justify it to somebody who was not in the room."
>
> "Every reading behind these lines — the apparent temperature, the ozone level,
> the cloud cover — is the same live FortyGuard read from a minute ago, for their
> block specifically. Nothing on this screen is a synthetic day."

---

## Part 4 — Find its controls. Step 2.

> "Now we look inside. This building publishes ninety five sensors and switches,
> with names like `hvac_oveAhu_yOA_u`."
>
> "Nobody can read that. Working out which one is the fresh air vent is thirty to
> forty percent of the labour on these projects. It is where they lose months."
>
> "We rank the matches and show the building's own description. **A person
> confirms each one.** Nothing is used from a guess."

Point at the greyed row.

> "And this one is honest: switchable glass is not in this building, so that
> feature stays off rather than pretending."

---

## Part 5 — Scored by someone else. Step 4.

This is the part worth taking time over. Nobody remembers a number; they remember whether you were
straight about how you got it.

> "Anyone can claim their software saves energy. So we gave our agent a building
> we did not build."
>
> "This is BOPTEST, the building simulator from the US Department of Energy.
> Researchers use it to compare control systems fairly. It runs the physics, and
> **it** does the scoring. Every number on this page is its, not ours."

### What BOPTEST actually is, and why it's the second examiner and not the first

We already have a digital twin (`core/src/twin`) — a first-order thermal-lag model we wrote
ourselves, and it's what powers the instant in-browser preview. The problem with grading yourself
against your own model is structural, not a matter of trying harder: it cannot disagree with us in
an interesting way, because we wrote both the controller and the exam. A judge or a buyer is right
to discount that number on principle, before even looking at it.

BOPTEST is a different kind of thing. It's an IBPSA project — the International Building
Performance Simulation Association — built with contributions from the US Department of Energy and
its national labs. The physics underneath is Modelica, compiled to FMI (the Functional Mock-up
Interface, an industry-standard simulation exchange format). We don't get to peek inside it or
adjust it. We send it commands, it runs real building physics, and it hands back KPIs — energy,
thermal discomfort, air-quality discomfort, cost — computed by code we did not write and cannot
tune. That's the entire value of it: not that it's more sophisticated than our twin, but that it
has no reason to be kind to us.

### How it's wired in — the adapter boundary, technically

`core/src/bms` defines a single interface, `BmsAdapter`. Everything above it — policies, the
arbiter, the control loop, `DecisionRecord` emission — talks to that interface and nothing else.
Three things can sit behind it:

```
BmsAdapter
├── SimulatedBms     in-process, instant, powers the live preview        (built)
├── BoptestAdapter   HTTP to the emulator, independent KPIs               (built, M6)
└── BacnetAdapter    real protocol, via a proxy, then real gear           (planned, M8)
```

Swapping the adapter is the only thing that changes. The policies don't know which one is running.

The actual exchange with the emulator, one experiment:

1. `PUT /initialize/{id}` — start the emulator on a chosen day, with a **seven-day warmup** first,
   so the building's thermal mass is already behaving normally before we touch anything. We are not
   grading a cold start.
2. `PUT /forecast/{id}` — read the emulator's own boundary conditions ahead: its weather, its
   schedules, its prices.
3. `POST /advance/{id}` — the write path. We send a setpoint and an outside-air fraction for the
   hour; the emulator returns measurements. Repeated for all 17 hours of a peak-cool day.
4. `GET /kpi/{id}` — at the end, independent energy, thermal-discomfort, air-quality-discomfort, and
   cost figures, computed entirely inside the emulator.

### The experiment design — three arms, one variable

Same building (`multizone_office_simple_air`), same day, same warmup, three controllers:

- **builtin** — BOPTEST's own published controller. We wrote none of it. This is "what a
  reasonably competent generic controller already does," and it's the only arm that isn't ours.
- **citywide** — our actual policies, arbiter, and actuators, fed a degraded signal: current
  conditions plus a metro-wide air-quality average — what a building on a normal weather feed
  would see.
- **copilot** — the identical code, identical actuators, fed the real hyperlocal FortyGuard
  forecast for that one block instead.

The only thing that differs between citywide and copilot is the input signal. Same thresholds,
same arbiter, same building, same day. That isolates the one claim this product's pitch actually
rests on: is the hyperlocal signal worth anything, once hardware and control logic are held
constant?

> "Three runs of the same day. On the left, the simulator's own controller, the
> only one we did not write."
>
> "The middle and the right are both **our** software, on the same equipment. The
> only difference between them is what the agent was allowed to see. The middle
> gets a normal city weather feed. The right gets the forecast for that one block."
>
> "That forecast is a real FortyGuard day, captured for this reference building's
> block — not synthetic, and not the live address we typed earlier, this is a
> separate capture we recorded to run the comparison. FortyGuard drives the
> decisions here. BOPTEST drives the physics of what happens when you act on
> them. Two different vendors, two different jobs, and neither one grades its
> own homework."

### What it actually returned

| | builtin | citywide | copilot |
|---|---|---|---|
| energy `ener_tot` | 0.0998 | 0.1965 | 0.1865 |
| cost `cost_tot` | 0.0103 | 0.0165 | 0.0169 |
| thermal discomfort `tdis_tot` | 0.38 | 0.00 | 0.00 |
| air quality discomfort `idis_tot` | 7.19 | 1613.69 | 1326.27 |
| max zone °F | 77.2 | 73.3 | 73.9 |
| hours on reduced intake | 0 | 0 | 3 |

**Copilot against citywide — same actuators, only the signal changed:** energy 5.1% less, air
quality discomfort 17.8% less, cost 2.3% more, peak electrical 10.3% more. Copilot took 10 decisions
across the day against citywide's 4.

**Copilot against BOPTEST's own controller: we lose.** 86.9% more energy, 63.6% more cost. We win
thermal discomfort outright — 0.00 against 0.38 — and hold a temperature (73.9°F) the built-in
controller never reaches (it tops out at 77.2°F). We buy that comfort with energy, and that
tradeoff stays on screen rather than getting explained away.

> "Same code, same building, same day. Only the information changed. Five percent
> less energy, and eighteen percent less stale air."
>
> "And against the simulator's own controller, we lose. More energy, more cost.
> We win comfort outright, and hold a temperature it never does."
>
> "We left that on screen. This test found two real bugs in our own model. That is
> exactly why it is here."

### Two rounds of self-correction — and why that's the point of paying for an independent scorer

**Round 1 (28 Aug).** The first scoring run surfaced two real defects in our own policy logic, not
tuning issues:

1. The purge-after-seal logic searched the forecast for the cleanest **PM2.5** hour, but the seal
   had been triggered by **ozone**. It waited for clean particulates while ozone was the actual
   hazard, and because PM2.5 was declining monotonically that day, a "cleaner hour" was always
   forecast just ahead — so it deferred until the forecast ran out, two hours late and 500 ppm over
   the CO₂ ceiling.
2. Our nominal setpoint constant, 72°F, was our own assumption, not this building's real setpoint —
   the DOE archetype actually runs at 75.2°F. Driving it three degrees colder than the building was
   designed for roughly doubled energy on its own, independent of anything else the agent did.

**Round 2 (29 Aug), re-running after fixes.** This pass turned up two bugs in the **test harness
itself**, not the agent:

1. The `citywide` arm had never actually been wired to move the actuators — it came back identical
   to the untouched baseline to four decimal places. The original "same loop, only the signal
   differs" comparison had quietly been copilot versus *no control at all*, not copilot versus a
   competing signal. Fixed so both controlled arms actuate from hour one.
2. A signed percentage was printed without stating direction — a run that used 97.5% *more* energy
   briefly displayed as `-97.5%` under a heading that read as savings. Fixed to state direction in
   words and show every KPI, not just energy.

The pattern across both rounds is the actual argument for building this thing at all: nothing here
was caught by our own test suite, because our own test suite encodes our own assumptions. Every one
of these was caught by a system that owes us nothing — different physics, different arithmetic, no
incentive to make us look good. That is worth more than a clean number would have been.

**If a judge points at the stale air row, this is the answer.** Do not improvise it.

> "That is one setting of ours: how much fresh air we hold as normal. It is too
> low for this building. It affects both of our columns equally, so the comparison
> between them still stands."
>
> "And notice the middle column never closes a vent all day, so this is not our
> smoke response. It is our number, we found it with this test, and we have not
> changed it, because picking a ventilation setting that flatters our own score is
> not something we will do."

The underlying finding, for anyone who wants the mechanism: `citywide` never reduces intake at all
across the full 17 hours — it holds the nominal 0.20 outside-air fraction the entire time — and it
still scores 1613.69 on air-quality discomfort against the built-in controller's 7.19, with indoor
CO₂ reaching 1408 ppm against the built-in controller's 918 ppm. So the gap isn't caused by our
sealing policy; it's caused by the constant itself. `NORMAL_OA_FRACTION = 0.20` looks too low for
this archetype — BOPTEST's own controller ventilates considerably harder. That traces to
[`thresholds.md`](../decisions/product/thresholds.md), and no amount of policy tuning fixes it. It
is left unfixed on purpose: changing a ventilation number is a health decision, and it needs a
standard behind it, not a tweak that happens to improve a score right before a pitch.

### What this predicts about a real building — and what it deliberately does not

**What carries over.** The `BmsAdapter` boundary the emulator sits behind is the same boundary a
real building sits behind. `epaulson/boptest-bacnet-proxy` exposes a BOPTEST emulator as actual
BACnet/IP devices, which means the identical point-discovery, point-mapping, and setpoint-write code
used against the emulator in this demo can run, unchanged, against a real gateway — no hardware, no
customer site, and the protocol a real building actually speaks. `BacnetAdapter` is planned as one
more implementation behind the same interface. The policies, the arbiter, and the control loop do
not change when it arrives — that not-changing is the architectural bet the whole design makes, and
it's the reason "swap the driver" is a true sentence rather than a hopeful one.

**What does not carry over.** BOPTEST supplies its own closed-world weather as the physics input to
its simulation; it does not consume FortyGuard's forecast as ground truth. FortyGuard drives the
*decisions* here — what the agent reasons over — while BOPTEST drives the *physics* — what happens
to the building when those decisions are acted on. Where the emulator's internal weather disagrees
with the real FortyGuard reading for that hour, that divergence is meant to be disclosed on screen,
never silently reconciled. And `multizone_office_simple_air` is the closest available DOE reference
archetype, not the Manhattan tower on the landing page — we say which archetype it is; we do not
claim it's the demo building.

**Still open, on record rather than quietly fixed:** the nominal setpoint should come from each
building's own schedule, read during the shadow phase, rather than sit as a constant we typed in;
and the outside-air fraction needs a real standard behind it before it changes. Both are flagged as
product decisions blocking on data or a standard, not as things we forgot.

---

## Part 6 — Permission, and the close.

> "Nothing is sent unless somebody allows it, one piece of equipment at a time.
> Everything starts off."

Flip one control to **Let it act**, and let the list below change.

> "Every layer above the device driver is built and running. Sensing, deciding,
> the safety limits, the point mapping, and independent scoring."
>
> "What is missing is the driver and the network path into the building. That is
> the layer we swap, not the system we rebuild."
>
> "And that is why the second building on the dashboard is greyed out."

---

## If a judge pushes

| Question | Answer |
|---|---|
| "So could you run this on my building next month?" | "Advisory, yes, tomorrow. Control, no. We need a BACnet driver and a gateway on site. Months, and probably with a partner." |
| "You lose on energy." | "Against that controller, yes, on that day — 86.9% more energy, 63.6% more cost. We buy comfort and cost with energy, and it is a real tradeoff. The apples-to-apples comparison is the one where only the signal changes — copilot against citywide — and there we win: 5.1% less energy, 17.8% less air-quality discomfort." |
| "Your stale air number is terrible." | "It is. That is our nominal fresh-air setting being too low for this building, not our smoke response. The middle column never closes a vent all day and still scores badly, which is how we know. It hits both our columns equally, so the comparison between them holds." |
| "Why not just fix it?" | "Because a ventilation number is a health decision. I am not going to pick one because it improves our score. It needs a standard behind it, and it is written up as open." |
| "Did the sandbox itself have bugs?" | "Yes, and we'd rather you hear it from us. The first run had a harness bug where one of the two controlled arms wasn't actually actuating, so an early comparison was really us against no control at all. We found it, fixed it, and re-ran. That's what an independent scorer is for — it's also independently capable of exposing our own mistakes." |
| "Is the air quality hyperlocal too?" | "No. Heat is per block, and that is real. Air quality is metro scale, and PM2.5 is daily. We probed it and it disproved part of our own original idea, so we changed the product." |
| "Is that a real building?" | "It is a simulation of a real US Department of Energy reference building. The physics is real. The equipment is not ours." |
| "Where exactly does FortyGuard show up versus BOPTEST?" | "FortyGuard is the real hyperlocal weather — the heatmap on the landing page, the address capture, the twelve-hour forecast behind the morning screen. It is what the agent decides from. BOPTEST only shows up in the sandbox step, standing in for a real building's physics so an independent scorer can grade us. They never talk to each other: FortyGuard tells the agent what to decide, BOPTEST tells us what happens when you act on it." |
| "How do you get from this simulation to an actual BACnet network?" | "The interface we built doesn't change. There's a proxy that exposes a BOPTEST emulator as real BACnet/IP devices, so the same point-discovery and setpoint-write code we ran against the emulator can run against a real gateway. What's missing is that gateway and a site to put it on — not new code." |

## Do not say

- "Ready to ship tomorrow." It is not, and one question exposes it.
- Any competitor number you have not checked today.
- "AI powered." Say what it does.
