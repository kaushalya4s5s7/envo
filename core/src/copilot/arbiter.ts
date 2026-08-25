import type { Actuator, Command, DecisionRecord, PolicyName, Proposal } from '../contracts';

/**
 * The arbiter.
 *
 * Policies propose; only this resolves conflicts. Two policies wanting the same
 * actuator is not an error, it is the normal case: free cooling wants the damper
 * open at the same moment a smoke plume wants it shut.
 *
 * Priority order is fixed in docs/decisions/product/arbitration.md and is not
 * negotiable by a policy.
 */

const RANK: Record<Proposal['priority'], number> = { health: 0, comfort: 1, energy: 2 };

export interface ArbiterContext {
  at: Date;
  buildingId: string;
  segmentId: string;
}

export interface ArbiterResult {
  commands: Command[];
  decisions: DecisionRecord[];
}

export function arbitrate(proposals: Proposal[], ctx: ArbiterContext): ArbiterResult {
  const byActuator = new Map<Actuator, Proposal[]>();
  for (const p of proposals) {
    byActuator.set(p.command.actuator, [...(byActuator.get(p.command.actuator) ?? []), p]);
  }

  const commands: Command[] = [];
  const decisions: DecisionRecord[] = [];

  for (const [actuator, contenders] of byActuator) {
    // Stable: equal priority keeps proposal order, so the result never depends
    // on which policy happened to run first.
    const ranked = [...contenders].sort((a, b) => RANK[a.priority] - RANK[b.priority]);
    const winner = ranked[0]!;
    const overridden = ranked.slice(1).map((p) => p.policy);

    commands.push(winner.command);
    decisions.push({
      at: ctx.at,
      buildingId: ctx.buildingId,
      segmentId: ctx.segmentId,
      command: winner.command,
      policy: winner.policy,
      trigger: winner.trigger,
      conflictsOverridden: dedupe(overridden),
      cost: costOf(winner, ranked.slice(1)),
      benefit: benefitOf(winner),
      rationale: rationaleFor(winner, ranked.slice(1)),
      reverseWhen: reversalFor(winner, actuator),
    });
  }

  return { commands, decisions };
}

const dedupe = (names: PolicyName[]): PolicyName[] => [...new Set(names)];

/** A decision that overrides another is never presented as free. */
function costOf(winner: Proposal, losers: Proposal[]): Record<string, number> {
  if (losers.length === 0) return {};
  if (winner.priority === 'health' && losers.some((l) => l.priority === 'energy')) {
    return { forgoneEnergySavingProposals: losers.length };
  }
  return { overriddenProposals: losers.length };
}

function benefitOf(winner: Proposal): Record<string, number> {
  return { [winner.trigger.parameter]: winner.trigger.observed };
}

function rationaleFor(winner: Proposal, losers: Proposal[]): string {
  if (losers.length === 0) return winner.rationale;
  const names = dedupe(losers.map((l) => l.policy)).join(', ');
  return `${winner.rationale} This overrides ${names}, which wanted the same actuator for a ` +
    `lower priority reason. The tradeoff is recorded rather than hidden.`;
}

function reversalFor(winner: Proposal, actuator: Actuator): string {
  const { parameter, threshold } = winner.trigger;
  switch (actuator) {
    case 'outside_air_damper':
      return `${parameter} falls back below its reopen threshold and holds there for the sustained ` +
        `reopen window, or indoor CO₂ reaches its ceiling and forces a purge.`;
    case 'hvac_setpoint':
      return `the forecast peak passes, or ${parameter} drops below ${threshold}.`;
    case 'facade_tint':
      return `${parameter} falls below ${threshold} after cloud de rating.`;
    case 'demand_response':
      return 'the demand response event ends, or comfort bounds are threatened.';
  }
}
