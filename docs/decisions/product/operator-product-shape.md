# Decision — What makes this a product, not a demo

**Status:** locked · 29 Aug 2026 for the operator-experience gap identified
after walking the built app end to end. Extends [`../../flows/product-flow.md`](../../flows/product-flow.md)
and [`who-we-build-for.md`](who-we-build-for.md) rather than replacing either. Does **not** reopen
[`dashboard-and-auth.md`](dashboard-and-auth.md) — Phase 1's zero-auth first answer stays exactly as
locked. This is about what happens *after* that first answer, which was always the plan and was
never built.

## The gap, stated precisely

Auth exists (`web/auth.ts` — real Google OAuth, or an honestly-labelled unverified fallback). A
database does not. So today, signing in gates a fixed two-card picker, not an account: nothing is
stored per user, a capture lives 30 minutes in memory, and reloading the tab returns you to zero.
That is a documented, deliberate cost of Phase 1 — see `dashboard-and-auth.md`. It stops being
deliberate the moment someone asks "so what does day 30 look like," because there currently is no
answer. That question is what this document answers.

## Who is actually opening this app on a Tuesday

Restated from `who-we-build-for.md`, tightened to the one persona this document designs for:

**The daily user is a facility manager or operations contractor, frequently running buildings for
someone else's portfolio under contract.** They are not the economic buyer and often not the person
who decided to try us. They have no time, thousands of existing BMS points, and a boss who was not
in the room when a recommendation was made. Two other roles read different surfaces of the same
data — the Director/VP of Facilities (economic buyer, wants attribution) and the sustainability
manager (wants defensible emissions numbers) — but neither is who opens the app every morning, and
this document does not design new screens for them beyond what's noted in "what's still missing"
below.

## What the competitors actually do, and what it implies

Full research: onboarding, home screen, portfolio framing, notifications, and trust surface for
Runwise, Parity, BrainBox AI (now Trane Tracer SC+), CIM PEAK, KODE Labs, and Facilio. Three things
were true everywhere real product-UX evidence existed, and one thing was conspicuously absent
exactly where a vendor markets itself as fully autonomous:

1. **The home screen changes on its own, without the user doing anything.** Runwise's
   savings-vs-baseline number and CIM's engineering checks "every 15 minutes" both work because they
   visibly accrue — day 40 looks different from day 1 with zero user effort. A demo screen is
   static; a product screen has a clock in it.
2. **Notifications are the retention mechanism, not a feature checkbox.** Runwise, KODE, Facilio,
   and CIM all lead with an alert tied to a *specific, resolvable* event — a boiler outage, a fault
   code, an SLA breach — not a generic "check your dashboard." That is what pulls the operator back
   in tomorrow morning. Without it, an app is something opened once at signup and never again.
3. **Reporting cadence has to match who's paying, not just who's clicking.** CIM's quarterly sponsor
   meetings and Facilio/KODE's ESG-formatted reports exist because the economic buyer is evaluated
   on a quarterly cycle, not a daily one. A product with no rolled-up artifact for that person feels
   disposable to them even if the operator likes it.
4. **The one vendor that markets itself as invisible (BrainBox/Trane, "no human interaction
   needed") is the one with essentially no public home-screen detail.** That's not an accident —
   full autonomy structurally can't produce a daily "what happened and why" screen, because there's
   nothing left for the human to look at. Useful to know, because our own pitch leans on exactly
   that kind of legibility (the rationale panel, the decision log) as a differentiator — we are
   closer in spirit to Facilio/CIM's "here's what changed and what we did" than to BrainBox's
   "trust us, it's handled."

Also notable: none of the six show a self-serve signup. Every one of them is sales-assisted,
hardware-first, or both. That's the gap Phase 1 is built to exploit, and this document doesn't
touch it — it's the strongest asset we have and the competitor research only reinforces that.

## What this means concretely: the data model

`product-flow.md` already sketched the entities; nothing here contradicts that sketch, it just
makes it buildable. Minimum viable for "feels like a real product":

| Entity | Fields that matter | Why it exists |
|---|---|---|
| **User** | email, name, org_id | From the session Google/NextAuth already provides — no new identity system, just a row |
| **Organization** | name, created_at | Even a single-user org from day one keeps the shape right for Phase 3's real teams |
| **Building** | address, geocode, segment binding, envelope profile, saved_at | The thing that currently vanishes after 30 minutes |
| **Run** | building_id, day, captured fixture, decisions[] | One per day the agent ran — this is what turns "a capture" into "history" |
| **Decision** | run_id, rationale, trigger, reversal condition, timestamp | Already modeled in `DecisionRecord` — just needs a table instead of a request-scoped array |
| **Connection** | building_id, state (`none`/`sandbox`/`bms_readonly`/`bms_write`) | Already exists conceptually in `/app/connect`; needs to persist per building instead of resetting |
| **PointMap** | building_id, vendor point name → canonical actuator | Already built in `/app/connect`; same persistence gap |
| **AutonomyGrant** | building_id, actuator, guardrails, expiry | Already built in `/app/autonomy`; same gap |
| **Digest subscription** | user_id, building_id, cadence (daily/weekly) | New. This is the "send me tomorrow's brief" step `dashboard-and-auth.md` already named as the correct next identity moment — email, magic link, nothing more |

Nothing here is a new idea. It is the existing sketch made concrete enough to estimate.

## What this means concretely: the sections a returning operator needs

Mapped against what's already built (per `product-flow.md`'s own surface list) versus genuinely new:

| Surface | Status | What changes |
|---|---|---|
| `/app` today view | built | Currently renders one session's capture. Becomes: renders the latest `Run` for a saved `Building`, so reloading the tab doesn't lose it. |
| `/app/decisions` | built | Currently one run's log. Becomes a real history: "what changed since you last looked" is the literal design test from `who-we-build-for.md`, and it can only be answered once there's a *last time* to compare against. |
| `/app/connect`, `/app/autonomy`, `/app/sandbox` | built | Currently reset every session. Becomes: state persists per building, so a grant made Monday is still visible Tuesday. |
| `/app/buildings` — a portfolio list | **new** | Not a map (Runwise's residential-super framing doesn't fit a commercial ops contractor running a handful of named sites) and not an auto-benchmarked table (that's CIM/KODE's analytics instinct, which `who-we-build-for.md` already rejected — "thousands of points already, no time, another chart is not a product"). A short list, one row per building, each row is the same one-line-per-action brief `/app` already renders, not a new chart type. |
| Daily/weekly digest email | **new** | The literal next step named in `dashboard-and-auth.md`'s own identity table. Lowest-effort, highest-leverage addition: it's the notification-as-retention-mechanism the competitor research says is doing most of the work everywhere it exists. |
| A rolled-up attribution report | **new, and explicitly out of scope for now** | This is the Director/VP-of-Facilities and sustainability-manager surface — modeled plan vs. what the building did, in a cadence that matches how *they're* pitched (monthly/quarterly, per the CIM/Facilio pattern). Worth naming so it isn't silently forgotten, but it depends on Phase 3's shadow-mode gap pricing existing first, which is a bigger lift than anything else in this document. |

## What stays exactly as it is

- **Phase 1's zero-auth first answer is untouched.** Nothing above suggests putting a login in
  front of address → your day. Persistence begins only *after* that first answer has already been
  delivered, exactly as `dashboard-and-auth.md` sequences it.
- **No dashboard-as-analytics.** The design test from `who-we-build-for.md` — *would this change
  what they do at 07:15 on a Tuesday* — still governs every row added to any of the above. A
  portfolio list of briefs passes that test; a chart does not.
- **No new autonomy behavior.** This document is about identity and continuity, not about what the
  agent is allowed to do to a building.

## Smallest slice, if there's time before the demo

In order of leverage per unit of build effort, not in order of dependency:

1. One table (`saved_building`, keyed by the session's email) so `/app` survives a reload — closes
   the single biggest "this is clearly a demo" tell.
2. The digest subscription capture ("email me tomorrow's brief") — no new screen, just a form and a
   cron, and it's literally already named as the correct next identity moment in the locked doc.
3. `/app/buildings` as a static list of whatever's in `saved_building` for that user — the
   portfolio framing, without inventing a second building's worth of fixtures.

Everything past that — real orgs, roles, the attribution report, real BMS connections — is Phase 3
and Phase 4 territory and is out of scope for a hackathon regardless of how this document lands.

## Sources

Competitor UX claims are drawn from public marketing pages, help docs, app-store listings, and
customer reviews as of 29 Aug 2026 — not vendor demos we were given access to. Where a claim
couldn't be verified publicly it's marked "not publicly documented" in the underlying research
rather than inferred. Key sources: [runwise.com/faq](https://www.runwise.com/faq),
[paritygo.com](https://www.paritygo.com/), [Trane Autonomous Control](https://www.trane.com/commercial/north-america/us/en/products-systems/smart-building-technology/ai-solutions/trane-autonomous-control.html),
[cim.io/solutions/building-analytics](https://www.cim.io/solutions/building-analytics),
[kodelabs.com/platform](https://kodelabs.com/platform/building-bi/),
[facilio.com/product](https://facilio.com/product/facility-management-software/).
