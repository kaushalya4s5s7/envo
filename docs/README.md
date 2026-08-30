# Docs

| Doc | Purpose |
|---|---|
| [`idea.md`](idea.md) | Historical concept and research, with current corrections |
| [`general.md`](general.md) | What the product is + stack table |
| [`architecture.md`](architecture.md) | End-to-end platform architecture and runtime boundaries |
| [`deployment.md`](deployment.md) | Node deployment, environment boundaries, and deliberate omissions |
| [`flows/decision-loop.md`](flows/decision-loop.md) | End to end sense→fuse→decide→actuate→verify |
| [`flows/product-flow.md`](flows/product-flow.md) | **Org to autonomous control.** How the market onboards, and how ours inverts it. |
| [`plans/2026-08-27-build.md`](plans/2026-08-27-build.md) | **Step-by-step build** — T00–T26, three gates |
| [`decisions/product/`](decisions/product/) | Product law: **what we can claim**, scope, thresholds, arbitration, honesty rails |
| [`decisions/platform/`](decisions/platform/) | Platform law: determinism, **sandbox** |
| [`../.cursor/rules/agents.mdc`](../.cursor/rules/agents.mdc) | Always-on agent constraints |
| [`../.agents/skills/fortyguard.md`](../.agents/skills/fortyguard.md) | Vendor playbook: call chain, tiers, gotchas |
| [`../.agents/skills/nestjs.md`](../.agents/skills/nestjs.md) | Project specific Nest decisions, narrowing the global rule set |

**Reading order for a fresh agent:** `architecture.md` → `decisions/**` → `plans/2026-08-27-build.md` → start at T00.

**Structure is not law.** `architecture.md` describes what exists and why. Rename or reshape it when the work calls for it. The `decisions/` files are the part that is law, because they encode product behaviour rather than layout.

**Decisions vs code:** decision docs are product law. Before changing a threshold, an arbitration rule, or a scope boundary, read and edit the matching decision file. Do not "fix" behavior a decision doc defines.
