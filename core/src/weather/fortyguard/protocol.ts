/**
 * FortyGuard wire level helpers. Pure, no network, so they are testable against
 * the saved real responses in docs/reference/fortyguard/samples/.
 *
 * The vendor's name appears in this folder and nowhere else.
 */

export type Status = string;

/** Status casing varies: `Completed`, `Processing`, and lower cased spellings all occur. */
export const statusOf = (body: unknown): Status =>
  String((body as { data?: { status?: unknown } })?.data?.status ?? '').toLowerCase();

/**
 * The endpoint docs name `Completed` and `Failed`; the quickstart also accepts
 * `succeeded` and `error`. Treat all four as terminal so a run cannot hang.
 */
const TERMINAL = new Set(['completed', 'succeeded', 'failed', 'error']);
export const isTerminal = (status: Status): boolean => TERMINAL.has(status);
export const isSuccess = (status: Status): boolean => status === 'completed' || status === 'succeeded';

export interface Polygon {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    properties: Record<string, never>;
    geometry: { type: 'Polygon'; coordinates: number[][][] };
  }>;
}

/**
 * Square area of interest around a point, `halfDeg` degrees to each side.
 *
 * GeoJSON order is [longitude, latitude], and the ring must close: an unclosed
 * polygon is rejected with 400.
 */
export function boxAround(lat: number, lon: number, halfDeg: number): Polygon {
  if (!(halfDeg > 0)) throw new RangeError(`halfDeg must be positive, received ${halfDeg}`);
  const ring = [
    [lon - halfDeg, lat - halfDeg],
    [lon + halfDeg, lat - halfDeg],
    [lon + halfDeg, lat + halfDeg],
    [lon - halfDeg, lat + halfDeg],
    [lon - halfDeg, lat - halfDeg],
  ];
  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } }],
  };
}

interface TileCollection {
  features: Array<{
    /**
     * A `tcm` tile also carries `min_temperature` and `max_temperature`, which
     * are the spread **within** that one square over the requested window. We
     * read all three: the average places the building, the range says how much
     * the block itself moves.
     */
    properties: {
      average_temperature: number;
      min_temperature?: number;
      max_temperature?: number;
      tile_id?: number | string;
    };
    geometry: { coordinates: number[][][] };
  }>;
}

/**
 * Statistics the vendor computes over the whole grid, returned alongside the
 * tiles as `stats_data`.
 *
 * Worth reading rather than recomputing: it is the vendor's own number for its
 * own data, which is a stronger thing to quote than our arithmetic over it, and
 * it includes a standard deviation we were not calculating at all.
 */
export interface TemperatureStats {
  minimum: number;
  maximum: number;
  mean: number;
  standardDeviation: number;
}

export function temperatureStats(result: unknown): TemperatureStats | undefined {
  const s = (result as { stats_data?: { temperature_stats?: Record<string, number> } })
    ?.stats_data?.temperature_stats;
  if (!s || typeof s['minimum'] !== 'number') return undefined;
  return {
    minimum: s['minimum'], maximum: s['maximum']!, mean: s['mean']!,
    standardDeviation: s['standard_deviation']!,
  };
}

/**
 * Temperature of the tile containing a point, °C.
 *
 * `env_params` requires this as an input, so the heatmap is a dependency of the
 * parameter call rather than optional context.
 *
 * Throws when the point is outside every tile: silently picking the nearest tile
 * would hide an area of interest that does not actually cover the building.
 */
export function tileTemperatureAt(map: TileCollection, lat: number, lon: number): number {
  for (const tile of map.features ?? []) {
    if (containsPoint(tile.geometry.coordinates[0] ?? [], lat, lon)) {
      return tile.properties.average_temperature;
    }
  }
  throw new Error(`no tile in the heatmap covers ${lat}, ${lon}`);
}

/** Ray casting. Ring coordinates are [lon, lat]. */
function containsPoint(ring: number[][], lat: number, lon: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = [ring[i]![0]!, ring[i]![1]!];
    const [xj, yj] = [ring[j]![0]!, ring[j]![1]!];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export interface TileGrid {
  cols: number;
  rows: number;
  /**
   * Row major, row 0 northernmost, so it renders top down without flipping.
   * `null` where the rotated lattice meets the square area of interest and no
   * tile was returned. A missing tile is not a cold tile and must not render
   * as one.
   */
  grid: (number | null)[][];
  buildingCol: number;
  buildingRow: number;
  buildingC: number;
  /** Spread inside the building's own tile across the window, when returned. */
  buildingMinC?: number;
  buildingMaxC?: number;
  minC: number;
  maxC: number;
  meanC: number;
  sourceTiles: number;
  /** The vendor's own statistics over the grid, when returned. */
  stats?: TemperatureStats;
}

/**
 * Lay an unordered tile list out as a grid, and locate the building within it.
 *
 * The API returns a flat FeatureCollection with no row or column indices, and
 * the lattice is **rotated** slightly off the lat/lon axes: a live Austin
 * heatmap returned 515 tiles with 515 distinct longitudes, because latitude
 * drifts as you walk along a row. Binning by coordinate therefore collapses to
 * one tile per row and renders a near empty grid.
 *
 * Each tile's own ring carries the answer. Consecutive corners are the two
 * lattice basis vectors, so every tile's position solves as an integer
 * combination of them regardless of rotation.
 *
 * Rows are ordered north to south: getting that backwards would mirror the city
 * silently, with every tile still a real measurement and nothing to catch it.
 */
export function tileGrid(map: TileCollection, lat: number, lon: number, result?: unknown): TileGrid {
  const features = map.features ?? [];
  if (features.length === 0) throw new Error('heatmap contained no tiles');

  const ring0 = features[0]!.geometry.coordinates[0] ?? [];
  if (ring0.length < 4) throw new Error('heatmap tile has no usable ring');
  const [o, a, , d] = ring0 as number[][];
  const origin = { x: o![0]!, y: o![1]! };
  const u = { x: a![0]! - origin.x, y: a![1]! - origin.y };
  const v = { x: d![0]! - origin.x, y: d![1]! - origin.y };
  const det = u.x * v.y - u.y * v.x;
  if (det === 0) throw new Error('heatmap tile ring is degenerate');

  /** Integer lattice coordinates of a tile's origin corner. */
  const cell = (f: TileCollection['features'][number]) => {
    const c = (f.geometry.coordinates[0] ?? [])[0] ?? [];
    const dx = c[0]! - origin.x, dy = c[1]! - origin.y;
    return {
      i: Math.round((dx * v.y - dy * v.x) / det),
      j: Math.round((u.x * dy - u.y * dx) / det),
    };
  };

  const cells = features.map(cell);
  const iMin = Math.min(...cells.map((c) => c.i)), iMax = Math.max(...cells.map((c) => c.i));
  const jMin = Math.min(...cells.map((c) => c.j)), jMax = Math.max(...cells.map((c) => c.j));
  const cols = iMax - iMin + 1, rows = jMax - jMin + 1;

  // `u` is the along-row step and `v` the up-column step, but neither direction
  // is guaranteed, so orient from the vectors rather than assuming.
  const colOf = (i: number) => (u.x >= 0 ? i - iMin : iMax - i);
  const rowOf = (j: number) => (v.y >= 0 ? jMax - j : j - jMin);

  const temps = features.map((f) => f.properties.average_temperature);
  const grid: (number | null)[][] = Array.from({ length: rows }, () => Array(cols).fill(null));
  features.forEach((f, k) => {
    const c = cells[k]!;
    grid[rowOf(c.j)]![colOf(c.i)] = temps[k]!;
  });

  const hit = features.findIndex((f) => containsPoint(f.geometry.coordinates[0] ?? [], lat, lon));
  if (hit < 0) throw new Error(`no tile in the heatmap covers ${lat}, ${lon}`);
  const b = cells[hit]!;
  const hitProps = features[hit]!.properties;

  return {
    cols, rows, grid,
    buildingCol: colOf(b.i), buildingRow: rowOf(b.j),
    buildingC: temps[hit]!,
    ...(typeof hitProps.min_temperature === 'number' ? { buildingMinC: hitProps.min_temperature } : {}),
    ...(typeof hitProps.max_temperature === 'number' ? { buildingMaxC: hitProps.max_temperature } : {}),
    minC: Math.min(...temps), maxC: Math.max(...temps),
    meanC: temps.reduce((x, y) => x + y, 0) / temps.length,
    sourceTiles: features.length,
    ...(result === undefined ? {} : (() => {
      const stats = temperatureStats(result);
      return stats ? { stats } : {};
    })()),
  };
}
