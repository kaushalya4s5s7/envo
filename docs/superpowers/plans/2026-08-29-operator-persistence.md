# Operator Persistence — Implementation Plan

> **For Claude:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the "smallest slice" from `docs/decisions/product/operator-product-shape.md` — a
captured building survives a reload, a signed-in user sees their own buildings again, and the
dashboard shows two real, honest modes (the sandbox/reference walkthrough, unchanged, and the
user's own captured buildings) instead of one working demo and one permanently-inert card.

**Architecture:** Add a single SQLite file (`bun:sqlite`, zero new dependencies) behind two small
store modules in `web/lib`. Wire it in at exactly the points that currently discard state: the
capture route persists on completion instead of only holding a 30-minute in-memory job, `/app`
redirects to a user's latest saved building when no capture id is in the URL, and a new
`/app/buildings` page lists history. Nothing about the sandbox/reference walkthrough
(`/app/building`, `/app/connect`, `/app/sandbox`, `/app/autonomy`, all driven by the committed
fixture in `web/lib/data.ts`) changes — it is a separate, deliberately fixture-driven path and this
plan does not touch it except to verify it still works at the end.

**Tech Stack:** Bun 1.3.6, `bun:sqlite` (built into the Bun runtime, no new package), Next.js 15 App
Router, existing NextAuth v5 session (`web/auth.ts`) as the identity source — no new identity system.

---

### Task 0: De-risk `bun:sqlite` under Next.js before building on it

**Files:**
- Modify: `web/next.config.ts`

Native/Bun-builtin modules sometimes need to be told apart from things Next tries to bundle for the
client. This task proves the import works before four more tasks depend on it.

- [ ] **Step 1: Add the external-package hint**

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['core'],
  /**
   * `bun:sqlite` is a Bun runtime built-in, not an npm package — Next must not
   * try to bundle it for a client boundary. See web/lib/db.ts.
   */
  serverExternalPackages: ['bun:sqlite'],
};

export default nextConfig;
```

- [ ] **Step 2: Smoke-test the import in isolation**

Run: `bun -e "import { Database } from 'bun:sqlite'; const d = new Database(':memory:'); d.exec('CREATE TABLE t(x)'); d.exec(\"INSERT INTO t VALUES (1)\"); console.log(d.query('SELECT * FROM t').all())"`

Expected: prints `[{ x: 1 }]` with no error. If this fails, stop and resolve it before continuing —
every later task assumes this works.

- [ ] **Step 3: Commit**

```bash
git add web/next.config.ts
git commit -m "chore: allow bun:sqlite as a server-external package"
```

---

### Task 1: The database module

**Files:**
- Create: `web/lib/db.ts`
- Modify: `.gitignore`

One file, WAL mode, idempotent schema creation. Tests inject `:memory:` instead of touching disk.

- [ ] **Step 1: Write `web/lib/db.ts`**

```ts
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
```

- [ ] **Step 2: Add the db file to `.gitignore`**

Add this line to `.gitignore` (near `runs/`):

```
web/data/
```

- [ ] **Step 3: Verify it loads**

Run: `cd web && bun -e "import { db } from './lib/db.ts'; console.log(db.query(\"SELECT name FROM sqlite_master WHERE type='table'\").all())"`

Expected: an array containing `saved_building`, `run`, `digest_subscription` (order may vary), no error.

- [ ] **Step 4: Commit**

```bash
git add web/lib/db.ts .gitignore
git commit -m "feat: add sqlite-backed db module for operator persistence"
```

---

### Task 2: Buildings store, test-first

**Files:**
- Create: `web/lib/buildings-store.ts`
- Test: `web/lib/buildings-store.test.ts`

**Files this replaces conceptually:** nothing — `web/lib/capture-store.ts` stays exactly as it is
(it's still the right tool for the 30-minute in-flight polling job). This is the durable layer
underneath it, not a replacement.

- [ ] **Step 1: Write the failing test**

```ts
// web/lib/buildings-store.test.ts
import { describe, test, expect, beforeEach } from 'bun:test';
import { createDb } from './db';
import {
  saveBuilding, getBuilding, listBuildingsForUser, getLatestBuildingForUser,
  saveRun, getLatestRun,
} from './buildings-store';
import type { Building } from 'core/contracts';

const building: Building = {
  id: 'live-1', name: 'Test Tower', segmentId: 'seg_1_1', lat: 40.7, lon: -74.0,
  floorAreaM2: 5000, nominalSetpointF: 72, thermalMassHours: 6,
  facades: [{ id: 'n', azimuthDeg: 0, glazedAreaM2: 100, tintable: true }],
};

describe('buildings-store', () => {
  let db: ReturnType<typeof createDb>;
  beforeEach(() => { db = createDb(':memory:'); });

  test('saves and retrieves a building', () => {
    saveBuilding(
      { id: 'b1', userEmail: 'a@b.com', address: '1 Main St', lat: 40.7, lon: -74, floorAreaM2: 5000, building, createdAt: 1_000 },
      db,
    );
    expect(getBuilding('b1', db)?.address).toBe('1 Main St');
  });

  test('getBuilding returns null for an unknown id', () => {
    expect(getBuilding('missing', db)).toBeNull();
  });

  test('lists buildings scoped to one user only', () => {
    saveBuilding({ id: 'b1', userEmail: 'a@b.com', address: 'A', lat: 1, lon: 1, floorAreaM2: 1, building, createdAt: 1 }, db);
    saveBuilding({ id: 'b2', userEmail: 'z@z.com', address: 'B', lat: 1, lon: 1, floorAreaM2: 1, building, createdAt: 2 }, db);
    const mine = listBuildingsForUser('a@b.com', db);
    expect(mine).toHaveLength(1);
    expect(mine[0]?.address).toBe('A');
  });

  test('getLatestBuildingForUser returns the most recently created one', () => {
    saveBuilding({ id: 'b1', userEmail: 'a@b.com', address: 'Old', lat: 1, lon: 1, floorAreaM2: 1, building, createdAt: 1 }, db);
    saveBuilding({ id: 'b2', userEmail: 'a@b.com', address: 'New', lat: 1, lon: 1, floorAreaM2: 1, building, createdAt: 2 }, db);
    expect(getLatestBuildingForUser('a@b.com', db)?.address).toBe('New');
  });

  test('getLatestBuildingForUser returns null when the user has none', () => {
    expect(getLatestBuildingForUser('nobody@nowhere.com', db)).toBeNull();
  });

  test('saveRun persists an artifact and assumptions, retrievable by building id', () => {
    saveBuilding({ id: 'b1', userEmail: 'a@b.com', address: 'A', lat: 1, lon: 1, floorAreaM2: 1, building, createdAt: 1 }, db);
    saveRun({ id: 'r1', buildingId: 'b1', capturedAt: 5, artifact: { hello: 'world' }, assumptions: ['x'] }, db);
    const run = getLatestRun('b1', db);
    expect(run?.artifact).toEqual({ hello: 'world' });
    expect(run?.assumptions).toEqual(['x']);
  });

  test('getLatestRun returns the newest run when a building has more than one', () => {
    saveBuilding({ id: 'b1', userEmail: 'a@b.com', address: 'A', lat: 1, lon: 1, floorAreaM2: 1, building, createdAt: 1 }, db);
    saveRun({ id: 'r1', buildingId: 'b1', capturedAt: 5, artifact: { day: 1 }, assumptions: [] }, db);
    saveRun({ id: 'r2', buildingId: 'b1', capturedAt: 10, artifact: { day: 2 }, assumptions: [] }, db);
    expect(getLatestRun('b1', db)?.artifact).toEqual({ day: 2 });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd web && bun test lib/buildings-store.test.ts`
Expected: FAIL — `buildings-store` module not found.

- [ ] **Step 3: Write the implementation**

```ts
// web/lib/buildings-store.ts
import type { Database } from 'bun:sqlite';
import type { Building } from 'core/contracts';
import { db as defaultDb } from './db';

/**
 * Durable counterpart to web/lib/capture-store.ts. That store holds one
 * in-flight capture for 30 minutes; this one holds what a signed-in user has
 * captured, indefinitely, so `/app` and `/app/buildings` survive a reload.
 * See docs/decisions/product/operator-product-shape.md.
 */

export interface SavedBuilding {
  id: string;
  userEmail: string;
  address: string;
  lat: number;
  lon: number;
  floorAreaM2: number;
  building: Building;
  createdAt: number;
}

export interface SavedRun {
  id: string;
  buildingId: string;
  capturedAt: number;
  artifact: unknown;
  assumptions: string[];
}

interface BuildingRow {
  id: string; user_email: string; address: string; lat: number; lon: number;
  floor_area_m2: number; building_json: string; created_at: number;
}

function rowToSaved(row: BuildingRow): SavedBuilding {
  return {
    id: row.id, userEmail: row.user_email, address: row.address,
    lat: row.lat, lon: row.lon, floorAreaM2: row.floor_area_m2,
    building: JSON.parse(row.building_json) as Building, createdAt: row.created_at,
  };
}

export function saveBuilding(input: {
  id: string; userEmail: string; address: string; lat: number; lon: number;
  floorAreaM2: number; building: Building; createdAt: number;
}, database: Database = defaultDb) {
  database.query(`
    INSERT OR REPLACE INTO saved_building
      (id, user_email, address, lat, lon, floor_area_m2, building_json, created_at)
    VALUES ($id, $userEmail, $address, $lat, $lon, $floorAreaM2, $buildingJson, $createdAt)
  `).run({
    $id: input.id, $userEmail: input.userEmail, $address: input.address,
    $lat: input.lat, $lon: input.lon, $floorAreaM2: input.floorAreaM2,
    $buildingJson: JSON.stringify(input.building), $createdAt: input.createdAt,
  });
}

export function getBuilding(id: string, database: Database = defaultDb): SavedBuilding | null {
  const row = database.query('SELECT * FROM saved_building WHERE id = $id')
    .get({ $id: id }) as BuildingRow | null;
  return row ? rowToSaved(row) : null;
}

export function listBuildingsForUser(userEmail: string, database: Database = defaultDb): SavedBuilding[] {
  const rows = database.query(
    'SELECT * FROM saved_building WHERE user_email = $userEmail ORDER BY created_at DESC',
  ).all({ $userEmail: userEmail }) as BuildingRow[];
  return rows.map(rowToSaved);
}

export function getLatestBuildingForUser(userEmail: string, database: Database = defaultDb): SavedBuilding | null {
  const row = database.query(
    'SELECT * FROM saved_building WHERE user_email = $userEmail ORDER BY created_at DESC LIMIT 1',
  ).get({ $userEmail: userEmail }) as BuildingRow | null;
  return row ? rowToSaved(row) : null;
}

export function saveRun(input: {
  id: string; buildingId: string; capturedAt: number; artifact: unknown; assumptions: string[];
}, database: Database = defaultDb) {
  database.query(`
    INSERT OR REPLACE INTO run (id, building_id, captured_at, artifact_json, assumptions_json)
    VALUES ($id, $buildingId, $capturedAt, $artifactJson, $assumptionsJson)
  `).run({
    $id: input.id, $buildingId: input.buildingId, $capturedAt: input.capturedAt,
    $artifactJson: JSON.stringify(input.artifact), $assumptionsJson: JSON.stringify(input.assumptions),
  });
}

export function getLatestRun(buildingId: string, database: Database = defaultDb): SavedRun | null {
  const row = database.query(
    'SELECT * FROM run WHERE building_id = $buildingId ORDER BY captured_at DESC LIMIT 1',
  ).get({ $buildingId: buildingId }) as
    { id: string; building_id: string; captured_at: number; artifact_json: string; assumptions_json: string } | null;
  if (!row) return null;
  return {
    id: row.id, buildingId: row.building_id, capturedAt: row.captured_at,
    artifact: JSON.parse(row.artifact_json), assumptions: JSON.parse(row.assumptions_json) as string[],
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && bun test lib/buildings-store.test.ts`
Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/buildings-store.ts web/lib/buildings-store.test.ts
git commit -m "feat: add durable buildings and runs store"
```

---

### Task 3: Digest subscription store, test-first

**Files:**
- Create: `web/lib/digest-store.ts`
- Test: `web/lib/digest-store.test.ts`

This captures intent only — no sending pipeline exists, and the UI in Task 6 must say so plainly.
See "still missing" in `operator-product-shape.md`.

- [ ] **Step 1: Write the failing test**

```ts
// web/lib/digest-store.test.ts
import { describe, test, expect, beforeEach } from 'bun:test';
import { createDb } from './db';
import { subscribe, getSubscription } from './digest-store';

describe('digest-store', () => {
  let db: ReturnType<typeof createDb>;
  beforeEach(() => { db = createDb(':memory:'); });

  test('subscribe then getSubscription returns the cadence', () => {
    subscribe('a@b.com', 'building-1', 'daily', db);
    expect(getSubscription('a@b.com', 'building-1', db)?.cadence).toBe('daily');
  });

  test('getSubscription returns null when none exists', () => {
    expect(getSubscription('a@b.com', 'building-1', db)).toBeNull();
  });

  test('subscribing again for the same user and building replaces the cadence', () => {
    subscribe('a@b.com', 'building-1', 'daily', db);
    subscribe('a@b.com', 'building-1', 'weekly', db);
    expect(getSubscription('a@b.com', 'building-1', db)?.cadence).toBe('weekly');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd web && bun test lib/digest-store.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// web/lib/digest-store.ts
import type { Database } from 'bun:sqlite';
import { db as defaultDb } from './db';

export type Cadence = 'daily' | 'weekly';

export interface DigestSubscription {
  userEmail: string;
  buildingId: string;
  cadence: Cadence;
  createdAt: number;
}

export function subscribe(
  userEmail: string, buildingId: string, cadence: Cadence, database: Database = defaultDb,
) {
  database.query(`
    INSERT INTO digest_subscription (user_email, building_id, cadence, created_at)
    VALUES ($userEmail, $buildingId, $cadence, $createdAt)
    ON CONFLICT (user_email, building_id) DO UPDATE SET cadence = excluded.cadence
  `).run({
    $userEmail: userEmail, $buildingId: buildingId, $cadence: cadence, $createdAt: Date.now(),
  });
}

export function getSubscription(
  userEmail: string, buildingId: string, database: Database = defaultDb,
): DigestSubscription | null {
  const row = database.query(
    'SELECT * FROM digest_subscription WHERE user_email = $userEmail AND building_id = $buildingId',
  ).get({ $userEmail: userEmail, $buildingId: buildingId }) as
    { user_email: string; building_id: string; cadence: Cadence; created_at: number } | null;
  return row
    ? { userEmail: row.user_email, buildingId: row.building_id, cadence: row.cadence, createdAt: row.created_at }
    : null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && bun test lib/digest-store.test.ts`
Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/digest-store.ts web/lib/digest-store.test.ts
git commit -m "feat: add digest subscription store"
```

---

### Task 4: Capture route persists on completion, and serves saved captures after expiry

**Files:**
- Modify: `web/app/api/capture/route.ts`

This is the change that actually closes "reload loses everything." `/onboarding` and `/api/capture`
are already behind the auth gate in `web/middleware.ts`, so a session always exists here — no new
friction is added to the capture flow itself.

- [ ] **Step 1: Add the imports and persist on job completion**

In `web/app/api/capture/route.ts`, add to the imports:

```ts
import { auth } from '@/auth';
import { log } from 'core/observability';
import { saveBuilding, saveRun, getBuilding, getLatestRun } from '@/lib/buildings-store';
```

Change the `POST` handler to capture the session email before firing the background job:

```ts
export async function POST(request: Request) {
  const { address, floorAreaM2, lat, lon } = (await request.json()) as {
    address?: string; floorAreaM2?: number; lat?: number; lon?: number;
  };
  if (!address || address.trim().length < 5) {
    return NextResponse.json({ error: 'Choose an address.' }, { status: 400 });
  }
  if (!process.env['FORTYGUARD_API_KEY']) {
    return NextResponse.json({ error: 'FORTYGUARD_API_KEY is not configured on the server.' }, { status: 500 });
  }
  const session = await auth();
  const job = createJob(address.trim());
  const chosen = Number.isFinite(lat) && Number.isFinite(lon)
    ? { lat: lat as number, lon: lon as number, label: address.trim() }
    : undefined;
  void run(
    job.id, address.trim(),
    Number(floorAreaM2) > 0 ? Number(floorAreaM2) : demoBuilding.floorAreaM2,
    chosen, session?.user?.email ?? null,
  );
  return NextResponse.json({ id: job.id, stage: job.stage });
}
```

Change the `run` function signature and the point where the job completes:

```ts
async function run(
  id: string, address: string, floorAreaM2: number,
  chosen: { lat: number; lon: number; label: string } | undefined,
  userEmail: string | null,
) {
  try {
    // ...unchanged body up to buildArtifact...

    patchJob(id, { stage: 'done', artifact, assumptions });

    if (userEmail) {
      try {
        saveBuilding({
          id, userEmail, address: label, lat, lon, floorAreaM2, building, createdAt: Date.now(),
        });
        saveRun({ id: `${id}-run`, buildingId: id, capturedAt: Date.now(), artifact, assumptions });
      } catch (e) {
        // A capture that succeeded but failed to persist should still render —
        // the user gets their answer, they just won't see it again tomorrow.
        log.warn('failed to persist captured building', {
          id, error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  } catch (e) {
    failJob(id, e instanceof Error ? e.message : String(e));
  }
}
```

- [ ] **Step 2: Fall back to the durable store when the in-memory job has expired**

Change the `GET` handler:

```ts
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = params.get('id');
  if (params.get('geometry')) {
    const g = id ? getGeometry(id) : undefined;
    if (!g) return NextResponse.json({ error: 'No geometry for that capture.' }, { status: 404 });
    return NextResponse.json(g);
  }
  const job = id ? getJob(id) : undefined;
  if (job) return NextResponse.json(job);

  if (id) {
    const saved = getBuilding(id);
    const savedRun = saved ? getLatestRun(saved.id) : null;
    if (saved && savedRun) {
      return NextResponse.json({
        id: saved.id, stage: 'done', address: saved.address,
        artifact: savedRun.artifact, assumptions: savedRun.assumptions,
      });
    }
  }
  return NextResponse.json({ error: 'This capture has expired. Run a new one.' }, { status: 404 });
}
```

- [ ] **Step 3: Type-check**

Run: `cd web && bun run check-types`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Run: `bun run dev` (from repo root), sign in, capture a real address at `/onboarding`, wait for
"done." Note the `?capture=<id>` in the URL. Restart the dev server (kills the in-memory job store),
reload the same URL — the day should render from the database instead of showing "that capture has
expired."

- [ ] **Step 5: Commit**

```bash
git add web/app/api/capture/route.ts
git commit -m "feat: persist completed captures and serve them after the in-memory TTL"
```

---

### Task 5: `/app` redirects to the signed-in user's latest building

**Files:**
- Modify: `web/app/app/page.tsx`

Only when there is no `?capture=` in the URL already — an explicit capture id, live or historical,
always wins.

- [ ] **Step 1: Rewrite the page as an async server component**

```tsx
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AppNav } from '@/components/app-nav';
import { Today } from '@/components/today';
import { getLatestBuildingForUser } from '@/lib/buildings-store';

export const metadata: Metadata = {
  title: 'Today — Envo',
  description: 'What the next twelve hours will do to your building, and what to do about it.',
};

export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<{ capture?: string }>;
}) {
  const { capture } = await searchParams;
  if (!capture) {
    const session = await auth();
    const latest = session?.user?.email ? getLatestBuildingForUser(session.user.email) : null;
    if (latest) redirect(`/app?capture=${latest.id}`);
  }

  return (
    <>
      <AppNav />
      <main id="main" className="flex flex-col items-center px-6 pt-24 pb-20 md:pt-[180px]">
        <Suspense fallback={null}>
          <Today />
        </Suspense>
      </main>
    </>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd web && bun run check-types`
Expected: no errors.

- [ ] **Step 3: Manual verification**

With a building already saved from Task 4's manual check, visit `/app` with no query string. Expect
an immediate redirect to `/app?capture=<id>` and your building's day rendering. A brand-new user
with nothing saved should see the unchanged "you are looking at the committed demo day" message —
confirm this by testing with a second Google account or the demo credentials provider.

- [ ] **Step 4: Commit**

```bash
git add web/app/app/page.tsx
git commit -m "feat: /app redirects to the latest saved building when no capture id is given"
```

---

### Task 6: `/app/buildings` — the portfolio list

**Files:**
- Create: `web/app/app/buildings/page.tsx`

Deliberately a list, not a map (residential-super framing doesn't fit this buyer) and not a
benchmarked analytics table (`who-we-build-for.md` already rejected that instinct). One row per
building, same one-line-per-action brief pattern as the rest of the app.

- [ ] **Step 1: Write the page**

```tsx
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AppNav } from '@/components/app-nav';
import { Reveal } from '@/components/reveal';
import { listBuildingsForUser } from '@/lib/buildings-store';

export const metadata: Metadata = {
  title: 'Your buildings — Envo',
  description: 'Every building you have captured, and when.',
};

export default async function BuildingsPage() {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');
  const buildings = listBuildingsForUser(session.user.email);

  return (
    <>
      <AppNav />
      <main id="main" className="flex flex-col items-center px-6 pt-24 pb-20 md:pt-[180px]">
        <Reveal delay={120}>
          <h1 className="heading-gradient max-w-[680px] text-center text-4xl font-semibold tracking-tighter text-balance md:text-6xl md:leading-none">
            Your buildings.
          </h1>
        </Reveal>
        <Reveal delay={230}>
          <p className="mt-6 max-w-[620px] text-center text-base text-pretty text-fg-2">
            Every address you have captured, most recent first.
          </p>
        </Reveal>

        <Reveal delay={340} className="mt-12 w-full max-w-[760px]">
          {buildings.length === 0 ? (
            <p className="text-center text-sm text-pretty text-fg-3">
              Nothing captured yet.{' '}
              <a href="/onboarding" className="text-fg-2 underline underline-offset-4">
                Type an address
              </a>{' '}
              to capture your first one.
            </p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {buildings.map((b) => (
                <li key={b.id}>
                  <a
                    href={`/app?capture=${b.id}`}
                    className="ease-fluid flex items-center justify-between gap-4 px-4 py-3 transition-colors duration-300 hover:bg-ink"
                  >
                    <span className="text-sm text-fg">{b.address}</span>
                    <span className="tabular font-mono text-xs text-fg-3">
                      captured {new Date(b.createdAt).toLocaleDateString()}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Reveal>
      </main>
    </>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd web && bun run check-types`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Visit `/app/buildings` signed in with at least one saved building — confirm it lists, most recent
first, and each row navigates to that day. Sign in as a user with none — confirm the empty-state
copy and link to `/onboarding`.

- [ ] **Step 4: Commit**

```bash
git add web/app/app/buildings/page.tsx
git commit -m "feat: add /app/buildings portfolio list"
```

---

### Task 7: Dashboard shows both modes — sandbox untouched, real buildings new

**Files:**
- Modify: `web/app/dashboard/page.tsx`

Additive only. The existing two-card grid (reference/simulated walkthrough, and the honestly-disabled
"connect a real building" BACnet card) is not touched at all — that preserves the sandbox mode
exactly as it is today. A new block above it renders only when the signed-in user has at least one
saved building.

- [ ] **Step 1: Add the import and the query**

```tsx
import { listBuildingsForUser } from '@/lib/buildings-store';
```

In `DashboardPage`, after the existing session check:

```tsx
const buildings = listBuildingsForUser(session.user.email);
```

- [ ] **Step 2: Insert a new block between the intro paragraph and the existing card grid**

Insert this `Reveal` block immediately before the existing `<Reveal delay={340} ...>` that renders
the two-card grid, and only when `buildings.length > 0`:

```tsx
{buildings.length > 0 ? (
  <Reveal delay={280} className="mt-10 w-full max-w-[1120px]">
    <div className="rounded-2xl border border-line bg-surface p-2">
      <div className="rounded-lg border border-line bg-ink p-4">
        <div className="flex items-center justify-between gap-4">
          <span className="font-mono text-xs tracking-wider text-fg-3">YOUR BUILDINGS</span>
          {buildings.length > 3 ? (
            <a href="/app/buildings" className="font-mono text-xs text-fg-2 underline underline-offset-4">
              See all {buildings.length} →
            </a>
          ) : null}
        </div>
        <ul className="mt-3 divide-y divide-line">
          {buildings.slice(0, 3).map((b) => (
            <li key={b.id}>
              <a
                href={`/app?capture=${b.id}`}
                className="ease-fluid flex items-center justify-between gap-4 py-2 transition-opacity duration-300 hover:opacity-70"
              >
                <span className="text-sm text-fg">{b.address}</span>
                <span className="tabular font-mono text-xs text-fg-3">
                  captured {new Date(b.createdAt).toLocaleDateString()}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  </Reveal>
) : null}
```

Renumber nothing else — the existing `delay={340}` and `delay={420}` blocks stay exactly as they
are, just visually pushed down when this new block renders above them.

- [ ] **Step 3: Type-check**

Run: `cd web && bun run check-types`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Sign in as a user with zero saved buildings — the dashboard must look **pixel-identical** to before
this task (this is the regression check for existing behavior). Sign in as a user with one or more
saved buildings — confirm the new block appears above the existing two-card grid, and that the
"Reference medium office" card still opens `/onboarding` exactly as before.

- [ ] **Step 5: Commit**

```bash
git add web/app/dashboard/page.tsx
git commit -m "feat: dashboard shows the signed-in user's saved buildings above the sandbox walkthrough"
```

---

### Task 8: Digest subscription capture (recorded, not sent)

**Files:**
- Create: `web/app/api/digest/route.ts`
- Create: `web/components/digest-form.tsx`
- Modify: `web/components/today.tsx`
- Modify: `web/middleware.ts`

This is the "send me tomorrow's brief" identity moment `dashboard-and-auth.md` already named. The
UI must not claim an email will arrive — nothing sends it yet.

- [ ] **Step 1: Add the API route**

```ts
// web/app/api/digest/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { subscribe, type Cadence } from '@/lib/digest-store';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }
  const { buildingId, cadence } = (await request.json()) as { buildingId?: string; cadence?: Cadence };
  if (!buildingId || (cadence !== 'daily' && cadence !== 'weekly')) {
    return NextResponse.json({ error: 'Choose a building and a cadence.' }, { status: 400 });
  }
  subscribe(session.user.email, buildingId, cadence);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Add `/api/digest` to the auth gate**

In `web/middleware.ts`, add `'/api/digest/:path*'` to the `matcher` array, alongside the existing
`/api/capture/:path*` entry.

- [ ] **Step 3: Add the form component**

```tsx
// web/components/digest-form.tsx
'use client';

import { useState } from 'react';

/**
 * Captures intent, does not send anything. There is no email pipeline yet —
 * see docs/decisions/product/operator-product-shape.md, "still open." Saying
 * otherwise here would be the exact thing honesty-rails.md forbids.
 */
export function DigestForm({ buildingId }: { buildingId: string }) {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const submit = async (cadence: 'daily' | 'weekly') => {
    setError('');
    const r = await fetch('/api/digest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buildingId, cadence }),
    });
    if (!r.ok) { setError('Could not save that.'); return; }
    setSaved(true);
  };

  if (saved) {
    return (
      <p className="mt-2 text-xs text-pretty text-fg-3">
        Saved to your account. Nothing is emailed yet — this only proves the preference is real
        before the sending part is built.
      </p>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-3">
      <span className="text-xs text-fg-3">Email me this building&rsquo;s brief:</span>
      <button
        type="button" onClick={() => void submit('daily')}
        className="rounded-full border border-line-2 px-3 py-1 text-xs font-medium text-fg-2 hover:bg-ink"
      >
        Daily
      </button>
      <button
        type="button" onClick={() => void submit('weekly')}
        className="rounded-full border border-line-2 px-3 py-1 text-xs font-medium text-fg-2 hover:bg-ink"
      >
        Weekly
      </button>
      {error ? <span className="text-xs text-alert">{error}</span> : null}
    </div>
  );
}
```

- [ ] **Step 4: Wire it into `Today`, only when a real building is loaded**

In `web/components/today.tsx`, add the import:

```ts
import { DigestForm } from './digest-form';
```

Immediately after the `job?.assumptions?.length ? ... : null` block at the end of the component,
add:

```tsx
{id && artifact ? <DigestForm buildingId={id} /> : null}
```

- [ ] **Step 5: Type-check**

Run: `cd web && bun run check-types`
Expected: no errors.

- [ ] **Step 6: Manual verification**

Capture a real address, wait for the day to render, click "Daily." Confirm the honest confirmation
copy appears and no email-sounding promise is made. Confirm the form does not appear on the
committed-demo-day view (no `?capture=` in the URL).

- [ ] **Step 7: Commit**

```bash
git add web/app/api/digest/route.ts web/components/digest-form.tsx web/components/today.tsx web/middleware.ts
git commit -m "feat: capture digest cadence preference, honestly labelled as not-yet-sent"
```

---

### Task 9: Regression check — the sandbox/reference walkthrough is untouched

**Files:** none modified — verification only.

Nothing in Tasks 1–8 should have touched `web/lib/data.ts`, `web/app/app/building/page.tsx`,
`web/app/app/connect/page.tsx`, `web/app/app/sandbox/page.tsx`, `web/app/app/autonomy/page.tsx`, or
their components (`Building`, `Connect`, `Sandbox`, `Autonomy`) — all of those render the committed
fixture from `web/lib/data.ts` and are the BOPTEST-scored proof path, independent of anything built
in this plan.

- [ ] **Step 1: Confirm no incidental edits**

Run: `git diff --stat` (or review the task-by-task commits) and confirm none of the five files above
appear.

- [ ] **Step 2: Full manual walk of the sandbox path**

`bun run dev`, sign in, from `/dashboard` click "Reference medium office" → walk through `/onboarding`
→ `/app/building` → `/app/connect` → `/app/sandbox` → `/app/autonomy`. Confirm every screen renders
exactly as it did before this plan (same numbers, same copy) — this is the "sandbox running
perfectly" requirement.

- [ ] **Step 3: Full manual walk of the real path**

From `/dashboard`, capture a genuinely different address than any used above. Confirm: the day
renders, it appears under "Your buildings" on `/dashboard` and on `/app/buildings`, and reloading
`/app` with no query string lands you back on it rather than the committed demo day.

- [ ] **Step 4: Full test and type-check pass**

Run: `cd web && bun test && bun run check-types`
Expected: all tests pass, no type errors.

Run (from repo root): `bun run check-types`
Expected: clean across all workspaces, per the CLAUDE.md non-negotiable.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: verify sandbox and real modes both work after operator persistence"
```
