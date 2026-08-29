# Envelope Copilot

Per building agent that fuses hyperlocal forecast environmental data into HVAC setpoint, shade tint, outside air damper, and demand response commands, and emits them into a **simulated** BMS. Hackathon build, 3 days. Concept: [`idea.md`](idea.md).

## Commands

```bash
bun install
bun run dev            # web on :3000
bun run build
bun run check-types    # run after every change, non negotiable
bun test               # core
```

Bun only. Never npm, yarn, or pnpm.

## Version control

**Status:** locked · added 29 Aug 2026.

The repo was only `git init`'d on 29 Aug 2026, but the work it contains was actually built across
24–29 Aug 2026 — that range is already on record throughout `docs/plans/milestones.md` and
`docs/decisions/`. The commit history must read as what actually happened, not as one dump on
init day.

- **Every commit's author date and committer date fall between 2026-08-24 and 2026-08-29
  inclusive.** Set both explicitly — `--date` alone only sets the author date:
  ```bash
  GIT_AUTHOR_DATE="2026-08-26 14:30:00" GIT_COMMITTER_DATE="2026-08-26 14:30:00" \
    git commit --date="2026-08-26 14:30:00" -m "..."
  ```
- **Dates strictly increase, commit to commit.** Pick each date from where the work actually sits
  in `milestones.md`'s own sequence (M0 before M1 before M2, decisions dated 27/28/29 Aug land on
  their own days) — never invent a date and never let a later commit land before an earlier one.
- **One reasoned unit of work per commit**, message explains why not just what, same discipline as
  any other commit in this project. Do not squash unrelated changes together to save time.
- This governs every commit from here forward, not only a one-time history reconstruction.

## Never invent

**This is the rule that matters most on this project.**

- **Do not write FortyGuard client code from memory or inference.** No endpoint paths, parameter names, auth schemes, response shapes, tier limits, or rate limits unless they came from documentation actually provided in the conversation. If it is not in `docs/reference/fortyguard/`, ask. Do not guess and do not pattern match from other weather APIs.
- **Do not invent numbers.** Every threshold traces to [`docs/decisions/product/thresholds.md`](docs/decisions/product/thresholds.md), which traces to an external standard. Every figure shown to a user is computed from a fixture, never typed by hand.
- **Do not present modeled output as measured.** See [`docs/decisions/product/honesty-rails.md`](docs/decisions/product/honesty-rails.md).
- **Never claim hyperlocal air quality.** It is metro scale and PM2.5 is daily. See `docs/decisions/product/what-we-can-claim.md`.
- **Do not claim a research fact without a live source.** [`idea.md`](idea.md) Appendix B tracks which claims are still unverified.
- When something is unknown, say so and ask. A blocked task reported honestly costs minutes. A fabricated one costs the pitch.

## Hard rules

| Rule | Detail |
|---|---|
| `core` imports nothing from `web` or `api` | Deleting both must leave `core` and its tests working |
| Policies are pure | `(state) => Proposal[]`. No I/O, no clock reads, no actuation, no conflict resolution. |
| Vendors hide behind capability names | FortyGuard only ever appears inside `core/src/weather/fortyguard/` |
| Thresholds come from constants | Never inline a number in a policy |
| Hysteresis on every threshold | Separate open and close values. A single threshold comparison is a bug. |
| Every command carries a rationale | An empty `DecisionRecord.rationale` fails the test suite |
| No `console.log` | Use the logger in `core/src/observability` |
| Demo runs offline | No live API calls outside fixture capture. [`determinism.md`](docs/decisions/platform/determinism.md) |
| Never commit secrets | `.env.local` is gitignored |

## Structure

```
web/     Next.js 15. Pitch at /, replay viewer at /replay
core/    the agent. Framework free TypeScript
api/     NestJS, only if capture and replay need a real home    (undecided)
fixtures/  captured or synthetic days, committed, deterministic
docs/
```

Structure is **not** law. Rename and reshape when the work calls for it. `docs/decisions/` **is** law, because it encodes product behaviour rather than layout.

## References

| Doc | Read it when |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | Adding a folder, or unsure where code belongs |
| [`docs/decisions/product/what-we-can-claim.md`](docs/decisions/product/what-we-can-claim.md) | **Before writing any pitch copy or metric.** Live probing disproved part of the original thesis. |
| [`docs/decisions/product/scope.md`](docs/decisions/product/scope.md) | Deciding whether to build something. Has the cut list. |
| [`docs/decisions/product/thresholds.md`](docs/decisions/product/thresholds.md) | Any numeric constant |
| [`docs/decisions/product/dashboard-and-auth.md`](docs/decisions/product/dashboard-and-auth.md) | Tempted to add a dashboard, a login, or persistence |
| [`docs/decisions/product/arbitration.md`](docs/decisions/product/arbitration.md) | Two policies disagree |
| [`docs/decisions/product/honesty-rails.md`](docs/decisions/product/honesty-rails.md) | Writing user facing copy or a metric |
| [`docs/decisions/platform/determinism.md`](docs/decisions/platform/determinism.md) | Anything touching data sources |
| [`docs/decisions/platform/sandbox-findings.md`](docs/decisions/platform/sandbox-findings.md) | **Before quoting any BOPTEST number.** Records where we lose. |
| [`docs/plans/milestones.md`](docs/plans/milestones.md) | Starting work. Current state and what is next. |
| [`.agents/skills/design-skills.md`](.agents/skills/design-skills.md) | Any UI, copy, colour, spacing, or type decision |
| [`.agents/skills/nestjs.md`](.agents/skills/nestjs.md) | Only if `api` gets built |
| [`.agents/skills/fortyguard.md`](.agents/skills/fortyguard.md) | ⚠️ **Currently unverified.** Do not implement from it. |

## Open decisions, blocking

Tracked in [`docs/decisions/product/scope.md`](docs/decisions/product/scope.md) and [`docs/plans/milestones.md`](docs/plans/milestones.md). Do not resolve these by assuming; ask.
