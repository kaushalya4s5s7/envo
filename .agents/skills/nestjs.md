# Skill — NestJS

Full rule set: the global `nestjs-best-practices` skill. This file records only the **project specific** decisions that override or narrow it.

## The boundary — read this first

`core/policies`, `core/copilot`, `core/twin`, `core/bms` are **framework agnostic**. No Nest imports, no decorators, no DI container. Nest wraps them; it never owns them.

**The test:** deleting `api` must not break any package. If it would, logic has leaked out of a package and into a provider.

## Feature modules — `arch-feature-modules`

```
api/src/
├── capture/     # FortyGuard capture → fixtures
├── replay/      # run a scenario → RunArtifact
├── artifacts/   # list and serve stored runs
├── health/      # liveness and readiness
├── shared/      # ZodValidationPipe, exception filter, logging interceptor
├── env.ts
└── app.module.ts
```

Never `controllers/`, `services/`, `dto/` at the top level.

## Injection tokens — `di-use-interfaces-tokens`

Every swappable implementation gets a symbol. This is how the simulated BMS becomes real without touching a caller, and how `live` and `replay` weather sources swap in tests.

```ts
export const BMS_ADAPTER = Symbol('BMS_ADAPTER');
export const WEATHER_SOURCE = Symbol('WEATHER_SOURCE');

@Module({ providers: [{ provide: BMS_ADAPTER, useClass: SimulatedBmsProvider }] })
```

Constructor injection only — `di-prefer-constructor-injection`. No property injection, no service locator.

## Zod, not class-validator — deliberate deviation

`security-validate-all-input` assumes class-validator DTOs. We use zod because `core/contracts` already owns every schema and both Next.js apps consume the same ones. Two schema sources would drift silently.

The rule still holds: a **global** `ZodValidationPipe` validates every controller boundary. Nothing reaches a service unvalidated.

## Baseline, from day one

| Rule | Implementation |
|---|---|
| `error-use-exception-filters` | One global filter in `shared/`. Controllers never format errors. |
| `devops-use-logging` | Nest `Logger` delegates to `core/observability`. No `console.log`. |
| `devops-use-config-module` | `ConfigModule.forRoot` fed by the t3-env object in `env.ts`. Validated once, at boot. |
| `micro-use-health-checks` | `/health` liveness and readiness |
| `test-use-testing-module` | `Test.createTestingModule`, simulated adapter bound to the token |
| `test-e2e-supertest` | One e2e on `/replay`, runs offline from a fixture |

## Not applicable here

`db-*` (no database), `security-auth-jwt` and `security-use-guards` (no auth, single operator), `arch-use-repository-pattern` (no persistence beyond the filesystem). Revisit each if the matching row in `docs/deployment.md` gets its trigger.

## Runtime

`api` runs on **Node**, because Nest depends on `reflect-metadata` and `emitDecoratorMetadata` and the Nest CLI build path is only fully supported there. Bun remains the package manager and the package test runner. Do not attempt to move the API onto the Bun runtime during the hackathon.
