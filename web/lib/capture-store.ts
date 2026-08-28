import type { Artifact } from 'core/copilot/artifact';
import type { TileGrid } from 'core/weather/fortyguard';

/**
 * In-memory job store for live captures.
 *
 * A FortyGuard capture takes roughly two minutes — the two async tasks are
 * submit-then-poll — so the request cannot be synchronous. Single instance and
 * deliberately not a database: persistence is Phase 2 in
 * docs/flows/product-flow.md, and faking it would be worse than not having it.
 * The UI says plainly that a capture is not saved.
 */

export type Stage =
  | 'geocoding' | 'heatmap' | 'reading-tile' | 'parameters' | 'deciding' | 'done' | 'failed';

/** Tiles arrive about a minute before the parameters do, so they ship early. */
export interface TilePreview extends TileGrid {
  address: string;
  lat: number;
  lon: number;
  timezone: string;
  tileTemperatureC: number;
  granularityM: number;
}

/**
 * Tile outlines in real coordinates, for drawing over a street map.
 *
 * Held apart from the job body because the client polls every two seconds for
 * two minutes: shipping ~500 polygons on every poll would be megabytes of
 * duplicate geometry. Fetched once, when the preview first appears.
 */
export interface CaptureGeometry {
  /** Each tile: four corners as [lon, lat], and its temperature in C. */
  cells: Array<{ r: [number, number][]; t: number }>;
  minC: number;
  maxC: number;
}

export interface CaptureJob {
  id: string;
  stage: Stage;
  startedAt: number;
  address: string;
  error?: string;
  preview?: TilePreview;
  artifact?: Artifact;
  /** Modeling assumptions applied because we cannot know them from an address. */
  assumptions?: string[];
}

/** Geometry lives outside the polled job body. Same lifetime, separate map. */
const geometries = new Map<string, CaptureGeometry>();

export const setGeometry = (id: string, g: CaptureGeometry) => {
  geometries.set(id, g);
  setTimeout(() => geometries.delete(id), TTL_MS).unref?.();
};

export const getGeometry = (id: string) => geometries.get(id);

const jobs = new Map<string, CaptureJob>();
const TTL_MS = 30 * 60_000;

export const createJob = (address: string): CaptureJob => {
  const job: CaptureJob = { id: crypto.randomUUID(), stage: 'geocoding', startedAt: Date.now(), address };
  jobs.set(job.id, job);
  setTimeout(() => jobs.delete(job.id), TTL_MS).unref?.();
  return job;
};

export const getJob = (id: string) => jobs.get(id);

export const patchJob = (id: string, patch: Partial<CaptureJob>) => {
  const j = jobs.get(id);
  if (j) Object.assign(j, patch);
};

export const failJob = (id: string, error: string) => patchJob(id, { stage: 'failed', error });
