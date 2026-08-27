import { request as httpRequest } from 'node:http';
import { log } from '../../observability';
import type { BoptestKpi, Inputs } from './protocol';

/**
 * BOPTEST HTTP client.
 *
 * Every `testid` response is wrapped as {status, message, payload}. See
 * docs/reference/boptest/api.md.
 */
export class BoptestClient {
  #base: string;
  #timeoutMs: number;
  #testid: string | null = null;

  /**
   * `select` and a `time_period` change both re initialize the Modelica model.
   * A `peak_cool_day` scenario runs a seven day warmup simulation: **7 min 18 s
   * observed**, for one arm.
   *
   * This goes over `node:http` rather than `fetch` because Bun caps a fetch at
   * 300 seconds and `AbortSignal.timeout` does not raise that ceiling — a run
   * failed at exactly 300.09 s while the worker went on to finish the job.
   */
  constructor(base = 'http://127.0.0.1:8000', timeoutMs = 1_800_000) {
    this.#base = base.replace(/\/$/, '');
    this.#timeoutMs = timeoutMs;
  }

  get testid(): string {
    if (!this.#testid) throw new Error('no test selected; call select() first');
    return this.#testid;
  }

  async select(testcase: string): Promise<string> {
    const body = await this.#send('POST', `testcases/${testcase}/select`) as
      { testid?: string } | string;
    const id = typeof body === 'string' ? body : body?.testid;
    if (!id) throw new Error(`select ${testcase} returned no testid: ${JSON.stringify(body).slice(0, 200)}`);
    this.#testid = id;
    log.info('boptest test selected', { testcase, testid: id });
    return id;
  }

  /** May trigger a re initialization, in which case the payload is initial measurements. */
  scenario(scenario: Record<string, unknown>) { return this.#send('PUT', `scenario/${this.testid}`, scenario); }
  initialize(startTime: number, warmupPeriod: number) {
    return this.#send('PUT', `initialize/${this.testid}`, { start_time: startTime, warmup_period: warmupPeriod });
  }
  setStep(seconds: number) { return this.#send('PUT', `step/${this.testid}`, { step: seconds }); }

  /** One control step. Inputs carry both `_u` values and `_activate` flags. */
  advance(inputs: Inputs) {
    return this.#send('POST', `advance/${this.testid}`, inputs) as Promise<Record<string, number>>;
  }

  kpi() { return this.#send('GET', `kpi/${this.testid}`) as Promise<BoptestKpi>; }
  inputs() { return this.#send('GET', `inputs/${this.testid}`); }
  measurements() { return this.#send('GET', `measurements/${this.testid}`); }
  stop() { return this.#send('PUT', `stop/${this.testid}`); }

  async #send(method: string, path: string, body?: unknown): Promise<unknown> {
    const url = new URL(`${this.#base}/${path}`);
    const payload = body === undefined ? undefined : JSON.stringify(body);

    const { status, text } = await new Promise<{ status: number; text: string }>((resolve, reject) => {
      const req = httpRequest(
        {
          hostname: url.hostname,
          port: url.port || 80,
          path: `${url.pathname}${url.search}`,
          method,
          headers: payload === undefined
            ? {}
            : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        },
        (res) => {
          let text = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => { text += chunk; });
          res.on('end', () => resolve({ status: res.statusCode ?? 0, text }));
        },
      );
      req.setTimeout(this.#timeoutMs, () => {
        req.destroy(new Error(`${method} ${path} exceeded ${this.#timeoutMs}ms`));
      });
      req.on('error', reject);
      if (payload !== undefined) req.write(payload);
      req.end();
    });

    let parsed: { status?: number; message?: string; payload?: unknown } = {};
    try { parsed = JSON.parse(text); } catch { parsed = {}; }
    if (status >= 400 || (parsed.status && parsed.status >= 400)) {
      throw new Error(`${method} ${path} failed: ${parsed.message ?? status}`);
    }
    return parsed.payload ?? parsed;
  }
}
