import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * One file, created on first use. `:memory:` (used by tests) skips the
 * filesystem entirely. Not a service — a hackathon-scale account and building
 * store, per docs/decisions/product/operator-product-shape.md.
 */
const DEFAULT_PATH = process.env['DB_PATH'] ?? join(process.cwd(), 'data', 'app.db');

export function createDb(path: string = DEFAULT_PATH): Database {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const database = new Database(path);
  database.exec('PRAGMA journal_mode = WAL;');
  migrate(database);
  return database;
}

function migrate(database: Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS saved_building (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      address TEXT NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      floor_area_m2 REAL NOT NULL,
      building_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_saved_building_user ON saved_building(user_email, created_at DESC);

    CREATE TABLE IF NOT EXISTS run (
      id TEXT PRIMARY KEY,
      building_id TEXT NOT NULL REFERENCES saved_building(id),
      captured_at INTEGER NOT NULL,
      artifact_json TEXT NOT NULL,
      assumptions_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_run_building ON run(building_id, captured_at DESC);

    CREATE TABLE IF NOT EXISTS digest_subscription (
      user_email TEXT NOT NULL,
      building_id TEXT NOT NULL REFERENCES saved_building(id),
      cadence TEXT NOT NULL CHECK (cadence IN ('daily', 'weekly')),
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_email, building_id)
    );
  `);
}

export const db = createDb();
