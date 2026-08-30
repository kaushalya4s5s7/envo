# Decision — Who we build for

**Status:** locked · **Product law.** Rewritten 28 Aug 2026 after researching who these products
actually sell to. The first version of this file was written from inference and got two things
materially wrong; both corrections are recorded below.

## What the market actually shows

| Product | Sells to | Scale | Segment |
|---|---|---|---|
| **Runwise** | Property owners and management companies — Related, LeFrak, Rudin, Equity Residential, FirstService, NYC MTA — plus **hundreds of condos, co-ops, and single building owners** | 7,500 (their FAQ) to 10,000+ (CNBC, Aug 2025) | **Multifamily residential** |
| **Parity** | Condos, co-ops, rental apartments, hotels | 200+ buildings, 65M sq ft | **Multifamily + hospitality** |
| **BrainBox AI** | Real estate owners, retail chains, airports, campuses | 14,000+ buildings. **Acquired by Trane Technologies**, announced 20 Dec 2024 | **Commercial** |

**The market splits in two and I had conflated them.** Runwise and Parity are overwhelmingly
*residential* — their wedge is boiler and steam control in condos and co-ops. BrainBox is commercial
— retail, offices, airports.

## Correction 3 — the nearest competitor is now owned by an OEM

**Trane Technologies agreed to acquire BrainBox AI on 20 December 2024**, closing early 2025, and is
integrating it into the Tracer SC+ building automation system. Verified 29 Aug 2026; see
[`../../idea.md`](../../idea.md) Appendix B.

Say this plainly rather than avoid it. It validates the category enough that the largest HVAC
manufacturer bought in, and it means our nearest competitor now has OEM distribution we cannot
match. Our argument was never that we out resource them. It is that value arrives **before** the
gateway, which is a sequencing advantage rather than a funding one — and an OEM acquisition makes
their install first motion more entrenched, not less.

## Correction 1 — we are a commercial product, not a multifamily one

The easiest buyer in this market is multifamily: single decision maker, acute pain, Runwise proved
the motion. **We cannot serve them.** Our policies drive VAV zone setpoints, economizer dampers, and
facade tint. A NYC co-op has a steam boiler and no economizer — which is exactly why Runwise's whole
product is boiler control. We validated against a DOE **medium office**, and that was the right
archetype.

So: **commercial**, and we say no to the easier market rather than pretend our tech fits it.

## Correction 2 — it is not one person, it is a committee

The first version of this file described a single operator running six to twelve buildings. That
number was invented. Real deployments involve, per BrainBox's own account of who they work with:

| Role | Part they play | What they need from us |
|---|---|---|
| **Facility manager / operator** *(daily user)* | Watches the BMS, fields complaints, moves setpoints. **Often a third party monitoring contractor, not an employee.** | A two minute morning brief that changes what they do today |
| **Director or VP of Facilities** *(economic buyer)* | Owns the portfolio budget, reports upward | Attribution: what the plan would have cost against what the building did |
| **Sustainability / energy manager** *(influencer)* | ESG targets, reporting | Emissions and peak load, per building, defensible |
| **IT and security** *(blocker)* | Compliance sign off on anything touching the BMS | A path that does not require them on day one |

## The qualifier that actually predicts fit

Not portfolio size. BrainBox's fit criterion is owners **"pursuing fast energy savings with limited
facilities engineering capacity"** — and operations are frequently outsourced to third party
monitoring companies.

So the buildings we serve are ones where **nobody has time to think about tomorrow**, whoever is
nominally in charge.

## What this changes in the product

**IT and security are a blocker we had not accounted for.** Every competitor must clear them before
delivering any value, because every competitor needs a BMS connection first. That makes advisory
first more valuable than we realised: **Phase 1 needs no BMS credentials, so it bypasses the
compliance gate entirely.** An operator can be using it before IT has heard of us. That is not a
convenience — it is the wedge.

**The daily user and the signer want different screens.** `/app` serves the operator: what today does
to this building and what to do about it. The economic buyer needs attribution, and the sustainability
influencer needs emissions. Neither is built, and neither should be faked.

**"Often a third party contractor" changes the tone.** The person reading our morning brief may be
managing buildings for someone else, under contract, with no authority to change strategy. Every
recommendation must stand on its own reading and reversal condition, because they may have to justify
it to a client who was not in the room.

## Their Tuesday — unchanged, and the reason we exist

```
07:10  Six buildings, one screen each, every one showing now.
14:00  Complaint from the top floor.
14:40  Reacts. Too late to matter for the peak.
19:00  Ozone crosses Unhealthy. Nobody notices.
Month  The bill arrives. No way to attribute any of it.
```

Everything is reactive, because every signal they have describes the present.

## What we deliberately do not build

- **Multifamily.** Our actuators do not exist in a co-op. Runwise owns that market and earned it.
- **A BMS replacement.** They have one and did not choose it.
- **Analytics.** Thousands of points already, no time. Another chart is not a product.
- **Autonomy on day one.** They will not grant it and should not.
- **Anything needing hardware.** They cannot approve capex — and needing none is what lets us skip
  the IT gate.

## The design test

**Would this change what they do at 07:15 on a Tuesday?** If it only changes what they *know*, it is
a dashboard, and they already have one.
