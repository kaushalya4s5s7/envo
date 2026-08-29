import postgres from 'postgres';

/**
 * Postgres, via `postgres` (postgres.js) — pure JS/TS, no native binding, no
 * runtime-special protocol. Two other drivers were tried first and both
 * failed in this exact Bun+Next stack: `bun:sqlite` can't be resolved by
 * Next's own server module loader, and `better-sqlite3`'s native N-API
 * binding crashes Bun's test runner outright. This one has neither failure
 * mode, verified against a real Neon instance from both a bare script and a
 * running dev server before anything was built on top of it.
 */

let client: ReturnType<typeof postgres> | null = null;
let migrated: Promise<void> | null = null;

function getClient() {
  if (!client) {
    const url = process.env['DATABASE_URL'];
    if (!url) throw new Error('DATABASE_URL is not set.');
    client = postgres(url, { ssl: 'require' });
  }
  return client;
}

async function migrate(sql: ReturnType<typeof postgres>) {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      created_at BIGINT NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at BIGINT NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS memberships (
      user_id TEXT NOT NULL REFERENCES users(id),
      org_id TEXT NOT NULL REFERENCES organizations(id),
      role TEXT NOT NULL CHECK (role IN ('owner','operator','viewer')),
      created_at BIGINT NOT NULL,
      PRIMARY KEY (user_id, org_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS invitations (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(id),
      email TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('owner','operator','viewer')),
      invited_by TEXT NOT NULL REFERENCES users(id),
      created_at BIGINT NOT NULL,
      accepted_at BIGINT
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email, accepted_at)`;
  await sql`
    CREATE TABLE IF NOT EXISTS saved_buildings (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(id),
      address TEXT NOT NULL,
      lat DOUBLE PRECISION NOT NULL,
      lon DOUBLE PRECISION NOT NULL,
      floor_area_m2 DOUBLE PRECISION NOT NULL,
      building_json JSONB NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at BIGINT NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_saved_buildings_org ON saved_buildings(org_id, created_at DESC)`;
  await sql`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      building_id TEXT NOT NULL REFERENCES saved_buildings(id),
      captured_at BIGINT NOT NULL,
      artifact_json JSONB NOT NULL,
      assumptions_json JSONB NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_runs_building ON runs(building_id, captured_at DESC)`;
  await sql`
    CREATE TABLE IF NOT EXISTS digest_subscriptions (
      user_id TEXT NOT NULL REFERENCES users(id),
      building_id TEXT NOT NULL REFERENCES saved_buildings(id),
      cadence TEXT NOT NULL CHECK (cadence IN ('daily','weekly')),
      created_at BIGINT NOT NULL,
      PRIMARY KEY (user_id, building_id)
    )
  `;
}

/** The shared client, schema guaranteed migrated before first use. */
export async function getDb() {
  const sql = getClient();
  migrated ??= migrate(sql);
  await migrated;
  return sql;
}
