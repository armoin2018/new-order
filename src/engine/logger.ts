/**
 * Structured Logger — New Order
 *
 * Provides level-gated, structured logging with environment-aware output.
 * In production builds (`import.meta.env.PROD`), only WARN and ERROR are emitted.
 * In development (`import.meta.env.DEV`), all levels are active.
 *
 * @example
 * ```typescript
 * import { logger } from '@/engine/logger';
 *
 * logger.info('Game initialized', { faction: 'usa', turn: 1 });
 * logger.warn('Save integrity mismatch', { expected: 'abc', actual: 'xyz' });
 * logger.error('Failed to parse save data', { raw: saveString });
 * ```
 */

/** Log severity levels ordered from least to most severe. */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

/** A single structured log entry. */
export interface LogEntry {
  readonly level: LogLevel;
  readonly timestamp: number;
  readonly tag: string;
  readonly message: string;
  readonly data?: Record<string, unknown>;
}

/** Logger configuration. */
export interface LoggerConfig {
  /** Minimum level to emit. Messages below this level are dropped. */
  readonly minLevel: LogLevel;
  /** Tag prefix for all messages (e.g., "New Order"). */
  readonly tag: string;
  /** Maximum entries retained in the in-memory ring buffer. */
  readonly maxBufferSize: number;
}

// ---------------------------------------------------------------------------
// Default configuration — production silences DEBUG/INFO
// ---------------------------------------------------------------------------

const IS_DEV =
  typeof import.meta !== 'undefined' &&
  typeof import.meta.env !== 'undefined' &&
  import.meta.env.DEV === true;

const DEFAULT_CONFIG: LoggerConfig = {
  minLevel: IS_DEV ? LogLevel.DEBUG : LogLevel.WARN,
  tag: 'New Order',
  maxBufferSize: 500,
};

// ---------------------------------------------------------------------------
// Logger implementation
// ---------------------------------------------------------------------------

/** In-memory ring buffer for log entries (useful for diagnostics export). */
const buffer: LogEntry[] = [];

let config: LoggerConfig = { ...DEFAULT_CONFIG };

function shouldLog(level: LogLevel): boolean {
  return level >= config.minLevel;
}

function emit(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    level,
    timestamp: Date.now(),
    tag: config.tag,
    message,
    data,
  };

  // Ring buffer — evict oldest when full
  if (buffer.length >= config.maxBufferSize) {
    buffer.shift();
  }
  buffer.push(entry);

  // Console output
  const prefix = `[${config.tag}]`;
  switch (level) {
    case LogLevel.DEBUG:
      // eslint-disable-next-line no-console
      console.debug(prefix, message, data ?? '');
      break;
    case LogLevel.INFO:
      // eslint-disable-next-line no-console
      console.info(prefix, message, data ?? '');
      break;
    case LogLevel.WARN:
      // eslint-disable-next-line no-console
      console.warn(prefix, message, data ?? '');
      break;
    case LogLevel.ERROR:
      // eslint-disable-next-line no-console
      console.error(prefix, message, data ?? '');
      break;
    default:
      break;
  }
}

/**
 * Structured logger with level-gated output and ring buffer.
 *
 * - **DEV mode**: DEBUG, INFO, WARN, ERROR all active
 * - **PROD mode**: Only WARN and ERROR emitted
 *
 * The in-memory buffer can be exported for crash diagnostics or post-game analysis.
 */
export const logger = {
  /** Log a debug-level message (dev only). */
  debug(message: string, data?: Record<string, unknown>): void {
    emit(LogLevel.DEBUG, message, data);
  },

  /** Log an informational message (dev only). */
  info(message: string, data?: Record<string, unknown>): void {
    emit(LogLevel.INFO, message, data);
  },

  /** Log a warning (always emitted). */
  warn(message: string, data?: Record<string, unknown>): void {
    emit(LogLevel.WARN, message, data);
  },

  /** Log an error (always emitted). */
  error(message: string, data?: Record<string, unknown>): void {
    emit(LogLevel.ERROR, message, data);
  },

  /** Get a shallow copy of the log buffer (newest last). */
  getBuffer(): readonly LogEntry[] {
    return [...buffer];
  },

  /** Clear the in-memory log buffer. */
  clearBuffer(): void {
    buffer.length = 0;
  },

  /** Reconfigure the logger at runtime. */
  configure(overrides: Partial<LoggerConfig>): void {
    config = { ...config, ...overrides };
  },

  /** Reset to default configuration. */
  resetConfig(): void {
    config = { ...DEFAULT_CONFIG };
  },
} as const;
