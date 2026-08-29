# Form answer — Your Idea & Motivation

~390 words. Every figure below is reproducible from the repo. Swap the final
paragraph for a personal line if you have one.

---

**The problem.** At 104°F, a commercial building's economizer logic recirculates to save cooling
energy and starves the offices of fresh air. When wildfire smoke crosses the city, the same damper
stays open and the building inhales it. The lever fails in both directions for one reason: the
controller cannot see outside its own façade. It runs on a single citywide weather feed.

**What is actually different at 60 metres.** We probed this rather than assumed it. FortyGuard's
temperature intelligence is genuinely per-block: in one 23 mi² heatmap of Manhattan we measured
**4,265 distinct tiles spanning 2.8°F at the same minute**. Air quality is not — PM2.5 and ozone
read identically in midtown and in Newark, 15 km apart. So we claim hyperlocal *heat*, and we say
plainly that air quality is metro scale. That correction cost us our original pitch and we made it
anyway.

**What we built.** Envelope Copilot chains FortyGuard's heatmap into environmental parameters for
one building's own block, then drives four actuators from four different slices of that feed:
pre-cool setpoints from forecast apparent temperature, façade tint from direct beam de-rated by
cloud cover, demand response from segment-level load, and the one nobody automates — reducing the
outside air intake when ozone crosses the EPA Unhealthy breakpoint, then timing the unavoidable CO₂
purge into the cleanest hour ahead. A Gemini agent arbitrates where policies conflict, and every
proposal it makes passes four deterministic rails before anything moves. On its first live call it
proposed a 740°F setpoint; the comfort rail refused it and wrote down why.

**What happened when we scored ourselves honestly.** We ran the agent against BOPTEST, the
IBPSA/US-DOE building emulator, so the numbers came from physics we did not write. Our own simulator
had claimed 26% savings. BOPTEST said we were using twice the energy. That gap exposed five real
defects — including two in our own physics model and a CO₂ purge that could defer forever. After
fixing them, on a real captured day the agent **cuts operating cost 3.9% against the emulator's own
controller** by shifting load off peak-price hours. It still uses more energy and we say so.

**What motivates us.** Buildings already have the actuators. What they lack is foresight, and a
thermal picture of their own block — both of which are pure software on infrastructure already
installed. We would rather ship a 3.9% number we can defend than a 26% one we cannot.
