import { describe, expect, it } from 'bun:test';
import {
  Building, Command, DecisionRecord, EnvSnapshot, Facade, Proposal, RunArtifact,
} from '../src/contracts';

const reading = {
  at: '2026-07-18T15:00:00.000Z',
  apparentTempF: 96.4, wetBulbF: 75.9, pm25Aqi: 162, ozoneAqi: 88, cloudCoverPercent: 24,
};
const clearSky = { ghiWm2: 812, dniWm2: 498, dhiWm2: 121 };
const snapshot = {
  segmentId: 'seg_40.7580_-73.9855', timezone: 'America/New_York',
  intervalMin: 60, now: reading, forecast: [reading], clearSky,
};

describe('EnvSnapshot', () => {
  it('parses a valid snapshot and coerces the timestamp', () => {
    const parsed = EnvSnapshot.parse(snapshot);
    expect(parsed.now.at).toBeInstanceOf(Date);
    expect(parsed.forecast).toHaveLength(1);
    expect(parsed.clearSky.dniWm2).toBe(498);
  });

  it('accepts the cloud cover percentages real responses contain', () => {
    for (const observed of [0, 17, 70, 98]) {
      expect(() => EnvSnapshot.parse({ ...snapshot, now: { ...reading, cloudCoverPercent: observed } })).not.toThrow();
    }
  });

  it('rejects cloud cover beyond 100 percent', () => {
    expect(() => EnvSnapshot.parse({ ...snapshot, now: { ...reading, cloudCoverPercent: 101 } })).toThrow();
  });

  /** AQI is an index, 0..500. A concentration in µg/m³ would pass; 600 must not. */
  it('rejects an AQI outside the index range', () => {
    expect(() => EnvSnapshot.parse({ ...snapshot, now: { ...reading, pm25Aqi: 600 } })).toThrow();
    expect(() => EnvSnapshot.parse({ ...snapshot, now: { ...reading, ozoneAqi: -1 } })).toThrow();
  });

  it('rejects a snapshot with no segment binding', () => {
    expect(() => EnvSnapshot.parse({ ...snapshot, segmentId: '' })).toThrow();
  });

  /** The vendor does not document a fixed step, so it must travel with the data. */
  it('requires the interval to be carried explicitly', () => {
    const { intervalMin: _omitted, ...without } = snapshot;
    expect(() => EnvSnapshot.parse(without)).toThrow();
  });

  it('requires a timezone so decisions can be made in local time', () => {
    expect(() => EnvSnapshot.parse({ ...snapshot, timezone: '' })).toThrow();
  });
});

describe('Building', () => {
  const facade = { id: 'west', azimuthDeg: 270, glazedAreaM2: 840, tintable: true };

  it('parses a building with at least one facade', () => {
    expect(Facade.parse(facade).azimuthDeg).toBe(270);
    const b = Building.parse({
      id: 'demo-nyc-001', name: 'Hudson Yards annexe', segmentId: 'seg_40.7580_-73.9855',
      lat: 40.758, lon: -73.9855, floorAreaM2: 14200, nominalSetpointF: 72, thermalMassHours: 3.4, facades: [facade],
    });
    expect(b.facades).toHaveLength(1);
  });

  it('rejects a building with no facades', () => {
    expect(() => Building.parse({
      id: 'x', name: 'x', segmentId: 's', lat: 0, lon: 0,
      floorAreaM2: 1, nominalSetpointF: 72, thermalMassHours: 1, facades: [],
    })).toThrow();
  });

  it('rejects an azimuth of 360 so north has one representation', () => {
    expect(() => Facade.parse({ ...facade, azimuthDeg: 360 })).toThrow();
  });
});

describe('Command', () => {
  it('discriminates on actuator', () => {
    expect(Command.parse({ actuator: 'hvac_setpoint', setpointF: 72, rampMin: 90 }).actuator).toBe('hvac_setpoint');
    expect(Command.parse({
      actuator: 'outside_air_damper', outsideAirFraction: 0, mode: 'recirculate', highMerv: true,
    }).actuator).toBe('outside_air_damper');
  });

  it('rejects an outside air fraction beyond unity', () => {
    expect(() => Command.parse({
      actuator: 'outside_air_damper', outsideAirFraction: 1.5, mode: 'economizer', highMerv: false,
    })).toThrow();
  });

  it('rejects a tint level outside the ladder', () => {
    expect(() => Command.parse({ actuator: 'facade_tint', facadeId: 'west', level: 'opaque' })).toThrow();
  });
});

const damperCommand = {
  actuator: 'outside_air_damper' as const, outsideAirFraction: 0, mode: 'recirculate' as const, highMerv: true,
};
const trigger = { parameter: 'pm25', observed: 76.9, threshold: 55.5, sustainedIntervals: 2 };

describe('Proposal and DecisionRecord', () => {
  it('parses a proposal carrying its rationale', () => {
    expect(Proposal.parse({
      policy: 'air_quality', command: damperCommand, priority: 'health', trigger,
      rationale: 'Sustained PM2.5 above the Unhealthy breakpoint at this segment.',
    }).priority).toBe('health');
  });

  /** honesty-rails.md: an empty rationale is a test failure, not a warning. */
  it('rejects a proposal with an empty rationale', () => {
    expect(() => Proposal.parse({
      policy: 'air_quality', command: damperCommand, priority: 'health', trigger, rationale: '',
    })).toThrow();
  });

  it('rejects a decision record with an empty rationale', () => {
    expect(() => DecisionRecord.parse({
      at: reading.at, buildingId: 'b', segmentId: 's', command: damperCommand, policy: 'air_quality',
      trigger, conflictsOverridden: [], cost: {}, benefit: {}, rationale: '', reverseWhen: 'x',
    })).toThrow();
  });

  it('rejects a decision record with no reversal condition', () => {
    expect(() => DecisionRecord.parse({
      at: reading.at, buildingId: 'b', segmentId: 's', command: damperCommand, policy: 'air_quality',
      trigger, conflictsOverridden: [], cost: {}, benefit: {}, rationale: 'because', reverseWhen: '',
    })).toThrow();
  });
});

describe('RunArtifact', () => {
  it('carries the synthetic flag and a threshold snapshot', () => {
    const artifact = RunArtifact.parse({
      fixtureId: 'hero', buildingId: 'demo-nyc-001', synthetic: true,
      generatedAt: reading.at, thresholds: { 'AIR.PM25_CLOSE': 55.5 },
      strategies: { envelope_copilot: [], baseline: [] },
    });
    expect(artifact.synthetic).toBe(true);
    expect(artifact.strategies.envelope_copilot).toEqual([]);
  });

  it('requires the synthetic flag to be stated explicitly', () => {
    expect(() => RunArtifact.parse({
      fixtureId: 'hero', buildingId: 'b', generatedAt: reading.at,
      thresholds: {}, strategies: { envelope_copilot: [], baseline: [] },
    })).toThrow();
  });
});
