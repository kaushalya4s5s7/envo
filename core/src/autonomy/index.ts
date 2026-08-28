import { Actuator, type Command } from '../contracts';

/**
 * Autonomy, granted per actuator.
 *
 * Never one switch. The damper is a health decision, the setpoint is a comfort
 * one, and an operator will reasonably trust us with one and not the other —
 * see docs/decisions/product/who-we-build-for.md, which records that they will
 * not grant blanket control and should not be asked to.
 *
 * The default is `off` for every actuator in the contract. A new actuator added
 * to `Actuator` therefore arrives closed rather than silently open.
 */

export const LEVELS = ['off', 'advisory', 'shadow', 'autonomous'] as const;
export type GrantLevel = (typeof LEVELS)[number];

export type GrantMap = Record<Actuator, GrantLevel>;

export const LEVEL_MEANING: Record<GrantLevel, string> = {
  off: 'Not considered at all. The policy does not even propose for this actuator.',
  advisory: 'Proposed and shown to you. Never sent.',
  shadow: 'Proposed and recorded against what the building actually did, so the value is priced before it is trusted. Still never sent.',
  autonomous: 'Sent to the building, inside the guardrails and reversible.',
};

export const DEFAULT_GRANTS: GrantMap =
  Object.fromEntries(Actuator.options.map((a) => [a, 'off'])) as GrantMap;

export interface Withheld {
  command: Command;
  level: GrantLevel;
  /** Why it was not sent, in words. An empty reason is a bug, as everywhere else. */
  reason: string;
}

/**
 * Split commands into what may be sent and what may not.
 *
 * This is the last gate before a command reaches a building, and it is
 * deliberately dumb: it knows nothing about policies, weather, or conflict
 * resolution. It only knows what a human has granted.
 */
export function gate(commands: Command[], grants: GrantMap) {
  const allowed: Command[] = [];
  const withheld: Withheld[] = [];

  for (const command of commands) {
    const level = grants[command.actuator] ?? 'off';
    if (level === 'autonomous') { allowed.push(command); continue; }
    withheld.push({
      command, level,
      reason: `Not sent. ${command.actuator} is set to ${level}: ${LEVEL_MEANING[level]}`,
    });
  }

  return { allowed, withheld };
}
