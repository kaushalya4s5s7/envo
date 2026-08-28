import type { Artifact } from 'core/copilot/artifact';
import agent from './agent.json';
import { run } from './data';
import { describeTrigger } from './plain';

/**
 * The morning brief, derived from a day.
 *
 * Shaped by docs/decisions/product/who-we-build-for.md: an operator with minutes
 * per building, standing up, on a phone. Every item answers "what do I do about
 * this", not "here is a number".
 *
 * A function rather than a module of constants, because the same brief is built
 * from a live capture and from the committed fixture.
 */

export type Severity = 'act' | 'watch' | 'clear';

export interface BriefItem {
  at: string;
  severity: Severity;
  headline: string;
  because: string;
  reverses: string;
}

export interface Brief {
  items: BriefItem[];
  headline: {
    peakF: number;
    peakAt: string;
    worstAqi: number;
    worstAt: string;
    actions: number;
    actNow: number;
  };
}

/** Times are rendered in the building's zone, not the reader's. */
const hhmm = (iso: string, timezone?: string) =>
  timezone
    ? new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone })
        .format(new Date(iso))
    : new Date(iso).toISOString().slice(11, 16);

export function buildBrief(day: Artifact | typeof run, timezone?: string): Brief {
  const intervals = day.intervals;
  const peak = intervals.reduce((a, b) => (b.env.apparentTempF > a.env.apparentTempF ? b : a));
  const worstAir = intervals.reduce((a, b) =>
    Math.max(b.env.ozoneAqi, b.env.pm25Aqi) > Math.max(a.env.ozoneAqi, a.env.pm25Aqi) ? b : a);

  const items: BriefItem[] = intervals
    .filter((i) => i.copilot.decisions.length > 0)
    .flatMap((i) =>
      i.copilot.decisions.map((d): BriefItem => {
        const label =
          d.actuator === 'hvac_setpoint' ? 'Shift the zone setpoint'
          : d.actuator === 'outside_air_damper' ? 'Cut outside air, raise filtration'
          : 'Tint the exposed facade';
        return {
          at: hhmm(i.at, timezone),
          severity: d.policy === 'air_quality' ? 'act' : 'watch',
          headline: label,
          because: describeTrigger(d.trigger.parameter, d.trigger.observed, d.trigger.threshold),
          reverses: d.reverseWhen,
        };
      }),
    );

  return {
    items,
    headline: {
      peakF: peak.env.apparentTempF,
      peakAt: hhmm(peak.at, timezone),
      worstAqi: Math.max(worstAir.env.ozoneAqi, worstAir.env.pm25Aqi),
      worstAt: hhmm(worstAir.at, timezone),
      actions: items.length,
      actNow: items.filter((i) => i.severity === 'act').length,
    },
  };
}

/** The committed day, for the demo path where no capture has been run. */
export const fixtureBrief = buildBrief(run);

export const agentSummary = agent.summary;
export const agentModel = agent.model;
