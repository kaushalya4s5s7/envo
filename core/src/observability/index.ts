/**
 * The only permitted logging surface. `console` is banned everywhere else
 * so that output can later be routed somewhere real without a grep and replace.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogFields {
  readonly [key: string]: unknown;
}

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

let threshold: LogLevel = 'info';
type Sink = (level: LogLevel, message: string, fields?: LogFields) => void;

const defaultSink: Sink = (level, message, fields) => {
  const line = fields ? `${message} ${JSON.stringify(fields)}` : message;
  // eslint-disable-next-line no-console
  console[level === 'debug' ? 'log' : level](`[${level}] ${line}`);
};

let sink: Sink = defaultSink;

export const log = {
  setLevel(level: LogLevel) { threshold = level; },
  /** Redirect output, e.g. to collect lines in a test. Pass nothing to restore. */
  setSink(next?: Sink) { sink = next ?? defaultSink; },
  debug: (message: string, fields?: LogFields) => emit('debug', message, fields),
  info: (message: string, fields?: LogFields) => emit('info', message, fields),
  warn: (message: string, fields?: LogFields) => emit('warn', message, fields),
  error: (message: string, fields?: LogFields) => emit('error', message, fields),
};

function emit(level: LogLevel, message: string, fields?: LogFields) {
  if (ORDER[level] < ORDER[threshold]) return;
  sink(level, message, fields);
}
