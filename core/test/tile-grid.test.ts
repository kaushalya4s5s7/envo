import { describe, expect, it } from 'bun:test';
import { tileGrid } from '../src/weather/fortyguard/protocol';

/**
 * A heatmap arrives as an unordered flat list of polygons with no row or column
 * indices, and the lattice is **rotated** a fraction of a degree off the lat/lon
 * axes — observed live, where 515 tiles produced 515 distinct longitudes. Any
 * recovery that assumes axis alignment degenerates to one tile per row.
 */

/**
 * A `cols` x `rows` lattice rotated by `rotDeg`, row 0 northernmost, in the
 * ring order the API uses: origin, +u, +u+v, +v.
 */
const collection = (cols: number, rows: number, temps: number[], rotDeg = 0, size = 0.001) => {
  const t = (rotDeg * Math.PI) / 180;
  const u = { x: Math.cos(t) * size, y: -Math.sin(t) * size };   // along a row, eastward
  const v = { x: Math.sin(t) * size, y: Math.cos(t) * size };    // up a column, northward
  const ox = -97.75, oy = 30.26;
  return {
    features: Array.from({ length: cols * rows }, (_, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      // Row 0 is the northernmost, so it sits at the highest v offset.
      const b = rows - 1 - r;
      const px = ox + c * u.x + b * v.x, py = oy + c * u.y + b * v.y;
      const pt = (mc: number, mv: number) => [px + mc * u.x + mv * v.x, py + mc * u.y + mv * v.y];
      return {
        properties: { average_temperature: temps[i] ?? 25 },
        geometry: { coordinates: [[pt(0, 0), pt(1, 0), pt(1, 1), pt(0, 1), pt(0, 0)]] },
      };
    }),
  };
};

/** A point just inside the tile at (col, row) of a lattice built as above. */
const inside = (cols: number, rows: number, col: number, row: number, rotDeg = 0, size = 0.001) => {
  const t = (rotDeg * Math.PI) / 180;
  const u = { x: Math.cos(t) * size, y: -Math.sin(t) * size };
  const v = { x: Math.sin(t) * size, y: Math.cos(t) * size };
  const b = rows - 1 - row;
  const cx = -97.75 + (col + 0.5) * u.x + (b + 0.5) * v.x;
  const cy = 30.26 + (col + 0.5) * u.y + (b + 0.5) * v.y;
  return { lat: cy, lon: cx };
};

describe('tileGrid', () => {
  for (const rot of [0, 0.6, -0.6]) {
    describe(`rotated ${rot} deg`, () => {
      it('recovers the column and row count', () => {
        const p = inside(4, 3, 0, 0, rot);
        const g = tileGrid(collection(4, 3, [], rot), p.lat, p.lon);
        expect(g.cols).toBe(4);
        expect(g.rows).toBe(3);
        expect(g.grid.length).toBe(3);
        expect(g.grid[0]!.length).toBe(4);
      });

      it('orders rows north to south, so row 0 renders at the top', () => {
        const temps = Array.from({ length: 9 }, (_, i) => 20 + i);
        const p = inside(3, 3, 0, 0, rot);
        const g = tileGrid(collection(3, 3, temps, rot), p.lat, p.lon);
        expect(g.grid[0]).toEqual([20, 21, 22]);
        expect(g.grid[2]).toEqual([26, 27, 28]);
      });

      it('locates the building cell', () => {
        const p = inside(4, 3, 2, 1, rot);
        const g = tileGrid(collection(4, 3, [], rot), p.lat, p.lon);
        expect(g.buildingCol).toBe(2);
        expect(g.buildingRow).toBe(1);
      });

      it('fills every cell of a complete lattice, leaving no false gaps', () => {
        const p = inside(6, 5, 0, 0, rot);
        const g = tileGrid(collection(6, 5, [], rot), p.lat, p.lon);
        expect(g.grid.flat().filter((c) => c === null).length).toBe(0);
        expect(g.cols * g.rows).toBe(30);
      });

      it('leaves a hole as null when a tile is missing, never as a temperature', () => {
        const c = collection(4, 3, [], rot);
        c.features.splice(5, 1);                    // one tile absent, as a clipped edge is
        const p = inside(4, 3, 0, 0, rot);
        const g = tileGrid(c, p.lat, p.lon);
        expect(g.grid.flat().filter((x) => x === null).length).toBe(1);
        expect(g.sourceTiles).toBe(11);
      });
    });
  }

  it('reports the spread that makes a citywide average wrong', () => {
    const p = inside(2, 2, 0, 0);
    const g = tileGrid(collection(2, 2, [20, 22, 24, 26]), p.lat, p.lon);
    expect(g.minC).toBe(20);
    expect(g.maxC).toBe(26);
    expect(g.meanC).toBe(23);
  });

  it('throws when no tile covers the building rather than guessing a cell', () => {
    expect(() => tileGrid(collection(2, 2, []), 12, 12)).toThrow(/covers/);
  });
});
