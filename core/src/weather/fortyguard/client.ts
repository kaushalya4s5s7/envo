import { log } from '../../observability';
import { isSuccess, isTerminal, statusOf, type Polygon } from './protocol';

/**
 * The FortyGuard client. Every analysis call is asynchronous: POST returns an
 * `activity_id`, and the result arrives from the status endpoint.
 *
 * docs/reference/fortyguard/api.md is the contract. Where it and the written
 * vendor docs disagree, it records observed behaviour and wins.
 */

const BASE = 'https://api.fortyguard.com/v1';

export interface ClientOptions {
  apiKey: string;
  /** Seconds between status polls. */
  pollIntervalS?: number;
  /** Give up after this many polls. */
  maxPolls?: number;
}

export interface DateTimeRange {
  start_date: string;
  start_time?: string;
  end_time?: string;
  end_date?: string;
  filter_type: 1 | 2 | 3 | 4;
}

export class FortyGuardClient {
  readonly #key: string;
  readonly #pollMs: number;
  readonly #maxPolls: number;

  constructor({ apiKey, pollIntervalS = 4, maxPolls = 90 }: ClientOptions) {
    if (!apiKey) throw new Error('FORTYGUARD_API_KEY is required');
    this.#key = apiKey;
    this.#pollMs = pollIntervalS * 1000;
    this.#maxPolls = maxPolls;
  }

  /** Submit a `tcm` heatmap and wait for its tiles. `granularity` is 60, 80, or 100. */
  async heatmap(polygon: Polygon, dateTime: DateTimeRange, granularity: 60 | 80 | 100) {
    const id = await this.#submit('/heatmap', {
      polygon_aoi: polygon,
      date_time: dateTime,
      granularity,
      analytic_type: 'tcm',
    });
    return this.#await(id, 'heatmap');
  }

  /**
   * Submit an environmental parameter request and wait for it.
   *
   * `temperature` is °C and is **required**; it comes from the heatmap tile
   * covering this point. Omitting `analysis` returns every parameter, which a
   * Premium key allows in a single call.
   */
  async envParams(lat: number, lon: number, temperatureC: number, dateTime: DateTimeRange, analysis?: string[]) {
    const id = await this.#submit('/env_params', {
      latitude: lat,
      longitude: lon,
      temperature: temperatureC,
      date_time: dateTime,
      ...(analysis ? { analysis } : {}),
    });
    return this.#await(id, 'env_params');
  }

  async #submit(path: string, body: unknown): Promise<string> {
    const response = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'api-key': this.#key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`${path} returned ${response.status}: ${JSON.stringify(payload).slice(0, 300)}`);
    }
    const id = (payload as { data?: { activity_id?: string } })?.data?.activity_id;
    if (!id) throw new Error(`${path} returned no activity_id: ${JSON.stringify(payload).slice(0, 300)}`);
    log.info('task submitted', { path, activityId: id });
    return id;
  }

  async #await(activityId: string, label: string): Promise<unknown> {
    for (let attempt = 0; attempt < this.#maxPolls; attempt++) {
      const response = await fetch(`${BASE}/status/${activityId}`, { headers: { 'api-key': this.#key } });
      const payload = await response.json().catch(() => ({}));

      // 404 is expected briefly after submission and must not be fatal.
      if (response.status === 404) {
        await sleep(this.#pollMs);
        continue;
      }
      if (!response.ok) {
        throw new Error(`status ${activityId} returned ${response.status}: ${JSON.stringify(payload).slice(0, 200)}`);
      }

      const status = statusOf(payload);
      if (isTerminal(status)) {
        if (!isSuccess(status)) throw new Error(`${label} ${activityId} finished as "${status}"`);
        log.info('task completed', { label, activityId, afterSeconds: (attempt * this.#pollMs) / 1000 });
        return (payload as { data?: { result?: unknown } }).data?.result;
      }
      await sleep(this.#pollMs);
    }
    throw new Error(`${label} ${activityId} did not finish within ${this.#maxPolls} polls`);
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
