/**
 * Plain language for everything the engine names in its own terms.
 *
 * The agent reasons in `apparentTempF` and `idis_tot`. A person reading the
 * screen for the first time should not have to. Every translation lives here so
 * the same words appear on every surface, and so the precise term can still be
 * shown alongside where credibility depends on it.
 */

export interface Plain {
  /** What a reader who has never seen a BMS would call it. */
  label: string;
  unit: string;
  /** One sentence on why it matters. Never a definition of the acronym. */
  hint: string;
}

const PARAMETERS: Record<string, Plain> = {
  apparentTempF: {
    label: 'Feels like temperature', unit: '°F',
    hint: 'Heat and humidity combined. What the building has to cool against, rather than what a thermometer reads.',
  },
  wetBulbF: {
    label: 'Wet bulb temperature', unit: '°F',
    hint: 'How much cooling you can get from outside air alone. Low means free cooling is available.',
  },
  ozoneAqi: {
    label: 'Ozone level', unit: 'AQI',
    hint: 'Ground level ozone on the US air quality index. Above 151 is Unhealthy for everyone.',
  },
  pm25Aqi: {
    label: 'Smoke and fine particles', unit: 'AQI',
    hint: 'Wildfire smoke and soot on the US air quality index. Above 151 is Unhealthy for everyone.',
  },
  co2Ppm: {
    label: 'Indoor carbon dioxide', unit: 'ppm',
    hint: 'Rises when a room is full and the fresh air intake is closed. A sign of stale air, not of pollution.',
  },
};

/** `beamOnFacade:east` and friends carry the face in the key. */
const FACADE = /^beamOnFacade:(\w+)$/;

export function plain(parameter: string): Plain {
  const facade = FACADE.exec(parameter);
  if (facade) {
    return {
      label: `Direct sun on the ${facade[1]} face`, unit: 'W/m²',
      hint: 'Sunlight landing straight on that side of the building, which becomes heat the cooling system has to remove.',
    };
  }
  return PARAMETERS[parameter] ?? {
    label: parameter, unit: '',
    hint: 'A measured value the agent watches.',
  };
}

/**
 * One sentence a person can read aloud.
 *
 * "Feels like temperature reached 103.5 °F, past the 95 °F line" rather than
 * "apparentTempF reached 103.5 against 95".
 */
export function describeTrigger(parameter: string, observed: number, threshold: number): string {
  const p = plain(parameter);
  const u = p.unit ? ` ${p.unit}` : '';
  return `${p.label} reached ${observed.toFixed(1)}${u}, past the ${threshold}${u} line`;
}

/** What each emulator KPI means, in the order a person would ask. */
export const KPI_PLAIN: Record<string, Plain> = {
  energy: {
    label: 'Energy used', unit: 'kWh per m²',
    hint: 'Total electricity for heating, cooling and fans across the day, per square metre of floor.',
  },
  cost: {
    label: 'Energy cost', unit: '$ per m²',
    hint: 'The same energy priced at the hour it was used, so shifting load to cheaper hours shows up here.',
  },
  thermal: {
    label: 'Time spent too warm or too cold', unit: 'degree hours',
    hint: 'How far outside the comfort band the rooms drifted, and for how long. Zero means never uncomfortable.',
  },
  air: {
    label: 'Stale air', unit: 'ppm hours',
    hint: 'Carbon dioxide above the ceiling, added up over the day. High means the building was under ventilated.',
  },
  peak: {
    label: 'Highest power draw', unit: 'W per m²',
    hint: 'The worst single moment of demand. What a utility bills a building for, separately from total energy.',
  },
};

/**
 * Equipment names, matching the words used when the points were mapped.
 *
 * The connect screen teaches somebody that a point is "the fresh air vent". If
 * this screen then calls the same thing an "outside air damper", they have to
 * learn it twice and cannot be sure it is the same thing.
 */
export const EQUIPMENT: Record<string, { label: string; risk: string }> = {
  hvac_setpoint: {
    label: 'The target temperature dial',
    risk: 'If we get this wrong somebody feels it within the hour, and we can put it back within the hour.',
  },
  outside_air_damper: {
    label: 'The fresh air vent',
    risk: 'Closing it keeps smoke out but lets air go stale. This is the one we guard hardest.',
  },
  facade_tint: {
    label: 'Switchable window glass',
    risk: 'Only affects glare and daylight. Usually the first thing anyone lets us touch.',
  },
  demand_response: {
    label: 'Shifting power to cheaper hours',
    risk: 'Saves money, and there is usually a utility contract behind it.',
  },
};

/**
 * How far the agent may go, per piece of equipment.
 *
 * The stored values are `off`, `advisory`, `shadow` and `autonomous`. Those are
 * our words, and only the first is guessable from the outside.
 */
export const PERMISSION: Record<string, { label: string; means: string }> = {
  off: { label: 'Off', means: 'We do not look at this at all.' },
  advisory: { label: 'Suggest', means: 'We tell you what we would do. You do it, or you do not.' },
  shadow: { label: 'Keep score', means: 'We record what we would have done and compare it against what your building actually did, so you can see what it was worth before trusting it.' },
  autonomous: { label: 'Let it act', means: 'We send it, inside the limits, and it can always be undone.' },
};

/** What each rule is called, when its name reaches a screen. */
export const POLICY: Record<string, string> = {
  precool: 'cooling early',
  tint: 'shading the sun',
  air_quality: 'air quality',
  demand_response: 'shifting power',
};
