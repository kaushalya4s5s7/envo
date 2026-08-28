import { describe, expect, it } from 'bun:test';
import { Actuator } from '../src/contracts';
import { DEFAULT_GRANTS, LEVELS, gate, type GrantMap } from '../src/autonomy';

/**
 * Autonomy is granted per actuator, never as a single switch.
 *
 * who-we-build-for.md: they will not grant blanket control and should not. The
 * damper is a health decision, the setpoint is a comfort one, and a building
 * operator will reasonably trust us with one and not the other.
 */

const cmd = (actuator: Actuator) => ({ actuator }) as Parameters<typeof gate>[0][number];

const grants = (over: Partial<GrantMap> = {}): GrantMap => ({ ...DEFAULT_GRANTS, ...over });

describe('gate', () => {
  it('withholds everything by default, because nothing has been granted', () => {
    const { allowed, withheld } = gate([cmd('hvac_setpoint'), cmd('outside_air_damper')], DEFAULT_GRANTS);
    expect(allowed).toHaveLength(0);
    expect(withheld).toHaveLength(2);
  });

  it('passes a command only where that actuator is autonomous', () => {
    const g = grants({ hvac_setpoint: 'autonomous' });
    const { allowed, withheld } = gate([cmd('hvac_setpoint'), cmd('outside_air_damper')], g);
    expect(allowed.map((c) => c.actuator)).toEqual(['hvac_setpoint']);
    expect(withheld.map((w) => w.command.actuator)).toEqual(['outside_air_damper']);
  });

  it('withholds at shadow level, which is the point of shadow', () => {
    const { allowed, withheld } = gate([cmd('hvac_setpoint')], grants({ hvac_setpoint: 'shadow' }));
    expect(allowed).toHaveLength(0);
    expect(withheld[0]!.reason).toMatch(/shadow/i);
  });

  it('gives every withheld command a written reason naming its level', () => {
    const { withheld } = gate(
      [cmd('hvac_setpoint'), cmd('facade_tint')],
      grants({ hvac_setpoint: 'advisory', facade_tint: 'off' }),
    );
    expect(withheld).toHaveLength(2);
    for (const w of withheld) expect(w.reason.length).toBeGreaterThan(20);
    expect(withheld[0]!.reason).toMatch(/advisory/i);
    expect(withheld[1]!.reason).toMatch(/off/i);
  });

  it('covers every actuator in the contract, so none defaults to open', () => {
    for (const a of Actuator.options) expect(DEFAULT_GRANTS[a]).toBe('off');
  });

  it('orders levels from least to most trusted', () => {
    expect(LEVELS).toEqual(['off', 'advisory', 'shadow', 'autonomous']);
  });
});
