import { GoogleGenAI } from '@google/genai';
import { log } from '../observability';
import { ARBITRATION_SCHEMA, normalizeAgentCommand } from './prompt';

/**
 * Gemini client. **The only file in the project that knows which vendor the
 * model comes from** — `guard.ts` and `prompt.ts` are provider agnostic, the
 * same way FortyGuard is confined to `core/src/weather/fortyguard/`.
 *
 * Verified against ai.google.dev on 28 Aug 2026: package `@google/genai`,
 * `client.interactions.create({ model, input, response_format })`, reply text on
 * `output_text`, API key read from `GOOGLE_GENAI_API_KEY`.
 *
 * **Runs at build time, never during the demo.** It enriches the artifact once;
 * the replay reads the artifact. docs/decisions/platform/determinism.md forbids
 * a network call on stage, and that applies to a model as much as to a vendor API.
 */

export interface AgentReply {
  command: unknown;
  rationale: string;
  confidence: 'low' | 'medium' | 'high';
}

export class GeminiAgent {
  #client: GoogleGenAI;
  #model: string;

  /**
   * `gemini-3.6-flash` and the explicit key are both verified, not assumed:
   * `gemini-2.0-flash` 404s with a message naming 3.6 as the replacement, and
   * the SDK does not auto-read GOOGLE_GENAI_API_KEY despite the docs.
   * SDK must be >= 2.0.0 — v1's Interactions schema is retired server side.
   */
  constructor(model = 'gemini-3.6-flash') {
    const apiKey = process.env['GOOGLE_GENAI_API_KEY'];
    if (!apiKey) throw new Error('GOOGLE_GENAI_API_KEY is not set; the agent layer cannot run');
    this.#client = new GoogleGenAI({ apiKey });
    this.#model = model;
  }

  /** Ask the model to arbitrate. The reply is unvalidated — the guard runs next. */
  async arbitrate(prompt: string): Promise<AgentReply> {
    const interaction = await this.#client.interactions.create({
      model: this.#model,
      input: prompt,
      response_format: { type: 'text', mime_type: 'application/json', schema: ARBITRATION_SCHEMA },
    });

    const text = (interaction as { output_text?: string }).output_text ?? '';
    log.info('agent replied', { model: this.#model, chars: text.length });

    try {
      const reply = JSON.parse(text) as AgentReply;
      return { ...reply, command: normalizeAgentCommand(reply.command) };
    } catch {
      // Malformed JSON is not an exception here: it is a proposal the contract
      // rail will refuse, and refusing it visibly is the point.
      return { command: { malformed: text.slice(0, 200) }, rationale: '', confidence: 'low' };
    }
  }

  /** Plain prose, no schema. Used for the operator facing day summary. */
  async explain(prompt: string): Promise<string> {
    const interaction = await this.#client.interactions.create({
      model: this.#model,
      input: prompt,
    });
    return (interaction as { output_text?: string }).output_text ?? '';
  }
}
