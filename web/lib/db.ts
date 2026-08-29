import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * A plain JSON file, not sqlite.
 *
 * Two sqlite drivers were tried and both failed in this exact stack: `bun:sqlite`
 * cannot be resolved by Next's own server module loader
 * (`next/dist/server/require.js`), confirmed against both `next build`'s page-data
 * collection and `next dev`'s actual request handling — not a build-time worker
 * quirk, the loader itself doesn't forward the `bun:` protocol. `better-sqlite3`
 * resolves fine as an ordinary npm package, but its native N-API binding crashes
 * Bun's test runner outright. `node:sqlite` isn't available in this Bun version.
 *
 * This store uses only `node:fs`/`node:path` — no native binding, no
 * runtime-special protocol — so it behaves identically under `bun test`,
 * `bun run dev`, and inside a compiled Next server bundle. Whole-file
 * read-modify-write is not safe under real concurrent writers; that's an
 * accepted simplification at hackathon scale (single process, low traffic),
 * not a hidden one. See docs/decisions/product/operator-product-shape.md.
 */

export interface SavedBuildingRow {
  id: string; userEmail: string; address: string; lat: number; lon: number;
  floorAreaM2: number; buildingJson: string; createdAt: number;
}

export interface RunRow {
  id: string; buildingId: string; capturedAt: number; artifactJson: string; assumptionsJson: string;
}

export interface DigestSubscriptionRow {
  userEmail: string; buildingId: string; cadence: 'daily' | 'weekly'; createdAt: number;
}

interface Store {
  savedBuildings: SavedBuildingRow[];
  runs: RunRow[];
  digestSubscriptions: DigestSubscriptionRow[];
}

const DEFAULT_PATH = process.env['DB_PATH'] ?? join(process.cwd(), 'data', 'app.json');

function emptyStore(): Store {
  return { savedBuildings: [], runs: [], digestSubscriptions: [] };
}

export interface Db {
  read(): Store;
  write(store: Store): void;
}

export function createDb(path: string = DEFAULT_PATH): Db {
  const inMemory = path === ':memory:';
  if (!inMemory) mkdirSync(dirname(path), { recursive: true });
  let memoryStore = emptyStore();

  return {
    read(): Store {
      if (inMemory) return memoryStore;
      if (!existsSync(path)) return emptyStore();
      return JSON.parse(readFileSync(path, 'utf8')) as Store;
    },
    write(store: Store) {
      if (inMemory) { memoryStore = store; return; }
      writeFileSync(path, JSON.stringify(store));
    },
  };
}

let singleton: Db | null = null;

/** The shared instance store functions default to. Created on first call, not on import. */
export function getDb(): Db {
  if (!singleton) singleton = createDb();
  return singleton;
}
