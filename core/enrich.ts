/**
 * M8 — run the agent over a replay and record what it proposed, what the rails
 * did about it, and how it explains the day.
 *
 * Runs at BUILD time. The output is baked into the artifact so /replay stays
 * offline and deterministic. docs/decisions/platform/determinism.md
 *
 * Usage: bun enrich.ts [fixture-id]
 */
import { EnvSnapshot } from './src/contracts';
import { demoBuilding } from './src/building';
import { airQualityPolicy, emptyLatches, precoolPolicy, tintPolicy, type LatchMap, type PolicyContext }
  from './src/policies';
import { arbitrate } from './src/copilot';
import { initialTwinState, stepTwin } from './src/twin';
import { COMFORT, MAX_CHANGES_PER_HOUR } from './src/utils';
import { buildArbitrationPrompt, buildExplanationPrompt, guardProposal } from './src/agent';
import { GeminiAgent } from './src/agent/gemini';
import { log } from './src/observability';

log.setLevel('error');
const fixtureId = process.argv[2] ?? 'demo-nyc-001-2026-08-07';
const raw = await Bun.file(`../fixtures/${fixtureId}.json`).json();
const snapshots: EnvSnapshot[] = raw.snapshots.map((s: unknown) => EnvSnapshot.parse(s));
const agent = new GeminiAgent();

let latches: LatchMap = emptyLatches();
let twin = initialTwinState(snapshots[0]!.now.at, demoBuilding.nominalSetpointF);
let damper = 0.2, setpointF = demoBuilding.nominalSetpointF;
const changes = new Map<string, number>();

interface AgentTurn {
  at: string;
  proposalsSeen: number;
  model: string;
  llmCommand: unknown;
  llmRationale: string;
  llmConfidence: string;
  accepted: boolean;
  rail?: string;
  railReason?: string;
  deterministicFallback: unknown;
  latencyMs: number;
}
const turns: AgentTurn[] = [];
const allDecisions: import('./src/contracts').DecisionRecord[] = [];

for (const env of snapshots) {
  const ctx: PolicyContext = {
    at: env.now.at, building: demoBuilding, env,
    indoor: { pm25: twin.indoorPm25, co2Ppm: twin.indoorCo2Ppm, zoneTempF: twin.zoneTempF },
    actuators: { outsideAirFraction: damper, setpointF, tint: {}, demandResponse: false },
    latches,
  };

  const aq = airQualityPolicy(ctx);
  const results = [aq, precoolPolicy(ctx), tintPolicy(ctx)];
  latches = results.reduce<LatchMap>((a, r) => ({ ...a, ...r.latches }), latches);
  const proposals = results.flatMap((r) => r.proposals);
  const { commands, decisions } = arbitrate(proposals, {
    at: env.now.at, buildingId: demoBuilding.id, segmentId: env.segmentId,
  });

  // The agent is asked only where there is a real decision to make.
  if (proposals.length > 0) {
    const started = Date.now();
    const reply = await agent.arbitrate(buildArbitrationPrompt({
      at: env.now.at, env, indoor: ctx.indoor, proposals, sealed: aq.state.sealed,
    }));
    const latencyMs = Date.now() - started;

    const actuator = (reply.command as { actuator?: string })?.actuator ?? 'unknown';
    const verdict = guardProposal(reply.command, {
      sealed: aq.state.sealed,
      indoorCo2Ppm: twin.indoorCo2Ppm,
      changesThisHour: changes.get(actuator) ?? 0,
    });

    turns.push({
      at: env.now.at.toISOString(),
      proposalsSeen: proposals.length,
      model: 'gemini-3.6-flash',
      llmCommand: reply.command,
      llmRationale: reply.rationale,
      llmConfidence: reply.confidence,
      accepted: verdict.accepted,
      ...(verdict.accepted ? {} : { rail: verdict.rail, railReason: verdict.reason }),
      deterministicFallback: commands[0] ?? null,
      latencyMs,
    });
    process.stderr.write(verdict.accepted ? '.' : 'X');
  }

  allDecisions.push(...decisions);

  // The building is always driven by the deterministic result. The agent's
  // proposal is recorded and judged; it does not get to steer until it earns it.
  for (const c of commands) {
    changes.set(c.actuator, (changes.get(c.actuator) ?? 0) + 1);
    if (c.actuator === 'outside_air_damper') damper = c.outsideAirFraction;
    if (c.actuator === 'hvac_setpoint') setpointF = c.setpointF;
  }
  twin = stepTwin(twin, {
    at: env.now.at, outdoorTempF: env.now.apparentTempF, outdoorPm25: env.now.pm25Aqi * 0.5,
    setpointF, outsideAirFraction: damper, occupants: 180,
  });
}

// Real decisions, captured as the loop ran — not reconstructed with a guessed policy.
const summary = await agent.explain(buildExplanationPrompt(allDecisions, raw.fixture.date));

await Bun.write('../web/lib/agent.json', JSON.stringify({
  _note: 'Produced at build time by bun enrich.ts. The replay never calls a model.',
  model: 'gemini-3.6-flash', fixtureId, generatedAt: new Date().toISOString(),
  guardrails: { comfortBand: [COMFORT.T_MIN_F, COMFORT.T_MAX_F], maxChangesPerHour: MAX_CHANGES_PER_HOUR },
  turns, summary,
}, null, 2) + '\n');

const rejected = turns.filter((t) => !t.accepted);
console.log(`\n\n${turns.length} agent turns, ${rejected.length} refused by a rail`);
for (const r of rejected) {
  console.log(`\n  ${r.at.slice(11, 16)}  rail: ${r.rail}`);
  console.log(`  proposed: ${JSON.stringify(r.llmCommand)}`);
  console.log(`  refused:  ${r.railReason?.slice(0, 150)}`);
}
console.log(`\nsummary:\n${summary}`);
