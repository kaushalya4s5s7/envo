import { describe, expect, it } from 'bun:test';
import { boxAround, isTerminal, statusOf, tileTemperatureAt } from '../src/weather/fortyguard/protocol';

const heat = await Bun.file(
  new URL('../../docs/reference/fortyguard/samples/heatmap.response.json', import.meta.url),
).json();

describe('status handling', () => {
  it('reads the status regardless of case', () => {
    expect(statusOf({ data: { status: 'Completed' } })).toBe('completed');
    expect(statusOf({ data: { status: 'PROCESSING' } })).toBe('processing');
  });

  /** The quickstart accepts `succeeded` and `error` alongside the documented pair. */
  it('accepts both spellings of each terminal state', () => {
    expect(isTerminal('completed')).toBe(true);
    expect(isTerminal('succeeded')).toBe(true);
    expect(isTerminal('failed')).toBe(true);
    expect(isTerminal('error')).toBe(true);
  });

  it('does not treat processing as terminal', () => {
    expect(isTerminal('processing')).toBe(false);
  });

  it('survives a response with no status at all', () => {
    expect(statusOf({})).toBe('');
    expect(isTerminal('')).toBe(false);
  });
});

describe('area of interest', () => {
  const aoi = boxAround(40.758, -73.9855, 0.006);

  it('is a GeoJSON FeatureCollection', () => {
    expect(aoi.type).toBe('FeatureCollection');
    expect(aoi.features[0]!.geometry.type).toBe('Polygon');
  });

  /** The API rejects an unclosed ring with 400. */
  it('closes the ring, first coordinate equal to last', () => {
    const ring = aoi.features[0]!.geometry.coordinates[0]!;
    expect(ring[0]).toEqual(ring.at(-1)!);
    expect(ring).toHaveLength(5);
  });

  it('puts longitude before latitude, as GeoJSON requires', () => {
    const [lon, lat] = aoi.features[0]!.geometry.coordinates[0]![0]!;
    expect(lon).toBeCloseTo(-73.9915, 4);
    expect(lat).toBeCloseTo(40.752, 4);
  });

  it('refuses a degenerate box', () => {
    expect(() => boxAround(40.758, -73.9855, 0)).toThrow();
  });
});

describe('reading a tile temperature from a real heatmap', () => {
  it('returns the temperature of the tile containing the point', () => {
    const first = heat.map_data.features[0]!;
    const ring = first.geometry.coordinates[0]!;
    const lon = ring.reduce((a: number, c: number[]) => a + c[0]!, 0) / ring.length;
    const lat = ring.reduce((a: number, c: number[]) => a + c[1]!, 0) / ring.length;
    expect(tileTemperatureAt(heat.map_data, lat, lon)).toBeCloseTo(first.properties.average_temperature, 6);
  });

  it('throws when the point falls outside every tile, rather than guessing', () => {
    expect(() => tileTemperatureAt(heat.map_data, 0, 0)).toThrow(/no tile/i);
  });

  it('reads average_temperature, the field the API actually returns', () => {
    expect(heat.map_data.features[0]!.properties).toHaveProperty('average_temperature');
  });
});
