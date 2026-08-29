# Decision — No dashboard, no login, in Phase 1

**Status:** locked · Decided 2026-08-29.

Two things every product in this category has that we deliberately do not build yet.

## No dashboard

[`who-we-build-for.md`](who-we-build-for.md) already settled this:

> Analytics. They have thousands of points and no time. One more chart is not a product.

The design test is **would this change what they do at 07:15 on a Tuesday?** A dashboard changes what
an operator *knows*. They already own a BMS full of knowing — that is the problem, not the gap.

So `/app` is a brief, not a dashboard. Every row is an action, the reading that triggered it, and the
condition that reverses it. The work was never to show more; it was to make the shown thing be about
**their** building, which is what the live capture fixes.

A portfolio view earns its place only when there is more than one saved building — Phase 2.

## No OAuth, and not for the obvious reason

The wedge identified in `who-we-build-for.md` is **value before the compliance gate**. Every
competitor needs BMS credentials and IT sign off before delivering anything; we need an address.
IT and security are the blocker in that committee, and Phase 1 bypasses them entirely.

Putting a login in front of the first answer throws that away. The sequence:

| Stage | Identity | Why there |
|---|---|---|
| Address → live capture → their day | **None.** Nothing asked, nothing stored. | The first answer has to arrive before any gate, or the wedge is gone. |
| "Send me tomorrow's brief" | Email, magic link. | Identity once it has been earned, not before. |
| Portfolio, teammates, roles | Real auth. | OAuth solves *team access to a shared portfolio* — a problem that does not exist until a portfolio does. |

`product-flow.md` specifies orgs and the `owner` / `operator` / `viewer` roles, and only `owner`
granting autonomy. That is correct and unchanged — it describes Phase 3, when a BMS connection
exists and the committee appears. It is not a Phase 1 requirement.

## What this costs us

A capture is held in memory for thirty minutes and then dropped. Reload the tab and it is gone.

This is a real limitation, not a hidden one — the onboarding and `/app` both say so in plain text.
Storing buildings without an account would mean a cookie pretending to be an identity, which is
worse than the honest gap.
