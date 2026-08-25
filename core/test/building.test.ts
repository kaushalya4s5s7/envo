import { describe, expect, it } from 'bun:test';
import { Building } from '../src/contracts';
import { demoBuilding, facadeById, tintableFacades } from '../src/building';

describe('building', () => {
  it('seeds a demo building that satisfies the contract', () => {
    expect(() => Building.parse(demoBuilding)).not.toThrow();
  });

  it('finds a facade by id', () => {
    expect(facadeById(demoBuilding, 'west').azimuthDeg).toBe(270);
  });

  it('throws on an unknown facade rather than returning undefined', () => {
    expect(() => facadeById(demoBuilding, 'cellar')).toThrow(/cellar/);
  });

  it('returns only the facades that can actually be tinted', () => {
    const tintable = tintableFacades(demoBuilding);
    expect(tintable.length).toBeGreaterThan(0);
    expect(tintable.every((f) => f.tintable)).toBe(true);
  });

  it('gives every facade a distinct id', () => {
    const ids = demoBuilding.facades.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
