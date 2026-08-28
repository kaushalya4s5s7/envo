/**
 * Point discovery and mapping.
 *
 * This is the step that kills projects. A building exposes hundreds of points
 * named `hvac_oveAhu_yOA_u`, and a human decides which one is the outside air
 * damper — roughly 30 to 40% of BMS integration labour, per idea.md Appendix B.
 *
 * We do not pretend to solve it. We rank candidates, explain every suggestion in
 * words, and require a person to confirm. A mapping accepted silently is how a
 * command ends up on the wrong actuator.
 */

export type CapabilityId =
  | 'zone_temp_setpoint' | 'outside_air_damper' | 'zone_temperature' | 'zone_co2' | 'facade_tint';

export interface Capability {
  id: CapabilityId;
  label: string;
  /** Without a required capability the agent cannot act at all. */
  required: boolean;
  kind: 'input' | 'measurement';
  /** What stops working when this is unmapped. */
  enables: string;
}

export const CAPABILITIES: Capability[] = [
  { id: 'zone_temp_setpoint', label: 'The target temperature dial', required: true, kind: 'input',
    enables: 'Lets us cool the building early, before the hot part of the afternoon. Without it we can only send advice.' },
  { id: 'zone_temperature', label: 'The room thermometer', required: true, kind: 'measurement',
    enables: 'Lets us check that an instruction actually changed something, instead of assuming it did.' },
  { id: 'outside_air_damper', label: 'The fresh air vent', required: false, kind: 'input',
    enables: 'Lets us pull in less outside air while smoke or ozone is passing. Without it we can only warn you it is happening.' },
  { id: 'zone_co2', label: 'The stale air sensor', required: false, kind: 'measurement',
    enables: 'Lets us reopen the vent before the air gets stuffy. This is the sensor that keeps a closed up building safe.' },
  { id: 'facade_tint', label: 'Switchable window glass', required: false, kind: 'input',
    enables: 'Lets us darken the sunny side of the building. Most buildings do not have this, and that is normal.' },
];

export interface DiscoveredPoint {
  name: string;
  description: string;
  unit: string | null;
  min: number | null;
  max: number | null;
  kind: 'input' | 'measurement';
}

export interface Candidate {
  point: DiscoveredPoint;
  score: number;
  /** Why this point was suggested, in words. Shown to whoever confirms it. */
  because: string;
}

export interface CapabilityMatch {
  capability: CapabilityId;
  label: string;
  required: boolean;
  enables: string;
  candidates: Candidate[];
}

interface Rule {
  /** All must appear in the description, lowercased. */
  needs: string[];
  /** Any of these disqualifies the point outright. */
  excludes?: string[];
  units?: string[];
}

const RULES: Record<CapabilityId, Rule | null> = {
  zone_temp_setpoint: {
    // The phrase, not the words apart: "Discharge air temperature to zone"
    // contains every one of zone, air, temperature and is a different sensor.
    needs: ['zone air temperature', 'cooling', 'setpoint'],
    // A heating setpoint reads almost identically and is the wrong actuator.
    excludes: ['heating'],
    units: ['K', 'C', 'degC', 'F'],
  },
  outside_air_damper: {
    needs: ['outside air', 'damper'],
    // Zone dampers balance airflow; they are not the economizer intake.
    excludes: ['for zone'],
  },
  zone_temperature: {
    needs: ['zone air temperature', 'measurement'],
    // Duct air is not room air. Discharge and supply temperatures read almost
    // identically in a point list and control to a completely different value.
    excludes: ['setpoint', 'discharge', 'supply'],
    units: ['K', 'C', 'degC', 'F'],
  },
  zone_co2: {
    needs: ['co2'],
    excludes: ['setpoint'],
    units: ['ppm'],
  },
  /** No standard point name exists. Left null so it reports honestly as absent. */
  facade_tint: null,
};

export function suggestMappings(points: DiscoveredPoint[]): CapabilityMatch[] {
  return CAPABILITIES.map((cap) => {
    const rule = RULES[cap.id];
    const candidates: Candidate[] = [];

    if (rule) {
      for (const point of points) {
        if (point.kind !== cap.kind) continue;
        const text = `${point.description} ${point.name}`.toLowerCase();
        if (!rule.needs.every((n) => text.includes(n))) continue;
        if (rule.excludes?.some((x) => text.includes(x))) continue;

        // A unit match is the strongest single signal, so it is scored separately
        // from the wording rather than folded into it.
        const unitMatch = rule.units ? (point.unit !== null && rule.units.includes(point.unit)) : true;
        if (rule.units && !unitMatch) continue;

        candidates.push({
          point,
          score: rule.needs.length + (rule.units ? 1 : 0),
          /**
           * The building's own words are the evidence. Restating our matching
           * rule back at the reader explained our code, not their building, and
           * dragged the vendor's units onto the screen with it.
           */
          because: point.description,
        });
      }
    }

    candidates.sort((a, b) => b.score - a.score || a.point.name.localeCompare(b.point.name));
    return {
      capability: cap.id, label: cap.label, required: cap.required,
      enables: cap.enables, candidates,
    };
  });
}

/** What the agent may actually do, given a confirmed mapping. */
export function readiness(mapping: Partial<Record<CapabilityId, string>>) {
  const have = (id: CapabilityId) => Boolean(mapping[id]);
  const missing = CAPABILITIES.filter((c) => c.required && !have(c.id));
  return {
    canActuate: missing.length === 0,
    missingRequired: missing.map((c) => c.id),
    policies: {
      precool: have('zone_temp_setpoint') && have('zone_temperature'),
      airQuality: have('outside_air_damper') && have('zone_co2'),
      tint: have('facade_tint'),
    },
  };
}
